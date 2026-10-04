import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { db } from '../config/firebase.js';
import type { LinkDocument, LinkStatus } from '../types/link.js';

export class FirestoreService {
  private collection = db.collection('links');

  /**
   * Gera um ID curto de 6 caracteres alfanuméricos para fácil digitação nos comandos
   */
  private generateShortId(): string {
    return crypto.randomBytes(3).toString('hex').toLowerCase();
  }

  /**
   * Salva um novo link no Firestore com status PENDENTE e data de cobrança calculada
   */
  public async salvarLink(data: {
    user_id: number | string;
    chat_id: number | string;
    user_name?: string;
    url: string;
    titulo: string;
    checklist: string[];
    dias_prazo_sugerido: number;
  }): Promise<LinkDocument> {
    const short_id = this.generateShortId();
    const agora = new Date();
    
    // Calcula a data da primeira cobrança com base no prazo sugerido
    const dataCobranca = new Date(
      agora.getTime() + data.dias_prazo_sugerido * 24 * 60 * 60 * 1000
    );

    const docData = {
      short_id,
      user_id: data.user_id,
      chat_id: data.chat_id,
      user_name: data.user_name || '',
      url: data.url,
      titulo: data.titulo,
      checklist: data.checklist,
      dias_prazo_sugerido: data.dias_prazo_sugerido,
      status: 'PENDENTE' as LinkStatus,
      criado_em: Timestamp.fromDate(agora),
      data_cobranca: Timestamp.fromDate(dataCobranca),
      tentativas_cobranca: 0,
    };

    const docRef = await this.collection.add(docData);

    return {
      id: docRef.id,
      ...docData,
    };
  }

  /**
   * Busca todos os links pendentes de um determinado usuário
   */
  public async buscarPendentesPorUsuario(userId: number | string): Promise<LinkDocument[]> {
    const snapshot = await this.collection
      .where('user_id', '==', userId)
      .where('status', '==', 'PENDENTE')
      .get();

    if (snapshot.empty) {
      return [];
    }

    const docs: LinkDocument[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as LinkDocument;
      docs.push({
        ...data,
        id: doc.id,
      });
    });

    // Ordena em memória por data_cobranca crescente (evita exigência de índice composto no Firestore)
    docs.sort((a, b) => {
      const timeA = (a.data_cobranca as Timestamp).toDate?.()?.getTime() || 0;
      const timeB = (b.data_cobranca as Timestamp).toDate?.()?.getTime() || 0;
      return timeA - timeB;
    });

    return docs;
  }

  /**
   * Localiza um documento por short_id ou id completo do Firestore
   */
  public async buscarLinkPorIdentificador(
    userId: number | string,
    idOrShortId: string
  ): Promise<LinkDocument | null> {
    const trimmed = idOrShortId.trim().toLowerCase();

    // 1. Tentar buscar por short_id
    const shortSnapshot = await this.collection
      .where('user_id', '==', userId)
      .where('short_id', '==', trimmed)
      .limit(1)
      .get();

    if (!shortSnapshot.empty) {
      const doc = shortSnapshot.docs[0];
      return { id: doc.id, ...(doc.data() as LinkDocument) };
    }

    // 2. Tentar buscar por ID de documento completo do Firestore
    try {
      const docRef = this.collection.doc(idOrShortId.trim());
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const data = docSnap.data() as LinkDocument;
        if (String(data.user_id) === String(userId)) {
          return { id: docSnap.id, ...data };
        }
      }
    } catch {
      // Ignora erro se id não for formato válido de doc ID
    }

    return null;
  }

  /**
   * Marca um link como 'CONCLUIDO'
   */
  public async concluirLink(
    userId: number | string,
    idOrShortId: string
  ): Promise<LinkDocument | null> {
    const link = await this.buscarLinkPorIdentificador(userId, idOrShortId);
    if (!link || !link.id) return null;

    await this.collection.doc(link.id).update({
      status: 'CONCLUIDO',
      concluido_em: Timestamp.now(),
    });

    return {
      ...link,
      status: 'CONCLUIDO',
    };
  }

  /**
   * Adia a data de cobrança de um link em X dias
   */
  public async adiarLink(
    userId: number | string,
    idOrShortId: string,
    dias: number
  ): Promise<LinkDocument | null> {
    const link = await this.buscarLinkPorIdentificador(userId, idOrShortId);
    if (!link || !link.id) return null;

    const agora = new Date();
    const novaDataCobranca = new Date(agora.getTime() + dias * 24 * 60 * 60 * 1000);

    await this.collection.doc(link.id).update({
      data_cobranca: Timestamp.fromDate(novaDataCobranca),
    });

    return {
      ...link,
      data_cobranca: Timestamp.fromDate(novaDataCobranca),
    };
  }

  /**
   * Busca todos os links PENDENTES cuja data_cobranca <= agora
   */
  public async buscarLinksParaCobranca(): Promise<LinkDocument[]> {
    const agora = Timestamp.now();

    // Busca todos pendentes e filtra por data_cobranca <= agora
    // Isso evita problemas com indexação composta no Firestore
    const snapshot = await this.collection
      .where('status', '==', 'PENDENTE')
      .get();

    if (snapshot.empty) {
      return [];
    }

    const agoraMillis = agora.toDate().getTime();
    const vencidos: LinkDocument[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data() as LinkDocument;
      const cobrancaMillis = (data.data_cobranca as Timestamp).toDate?.()?.getTime() || 0;
      
      if (cobrancaMillis <= agoraMillis) {
        vencidos.push({
          id: doc.id,
          ...data,
        });
      }
    });

    return vencidos;
  }

  /**
   * Registra que uma cobrança foi enviada, reagenda para +24h e incrementa tentativas
   */
  public async registrarCobrancaRealizada(docId: string, novaDataCobranca: Date): Promise<void> {
    await this.collection.doc(docId).update({
      tentativas_cobranca: FieldValue.increment(1),
      ultima_cobranca: Timestamp.now(),
      data_cobranca: Timestamp.fromDate(novaDataCobranca),
    });
  }
}

export const firestoreService = new FirestoreService();
