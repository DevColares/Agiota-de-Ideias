import admin from 'firebase-admin';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { ENV } from './env.js';

let firestoreInstance: Firestore | null = null;

export function initFirebase(): Firestore {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  if (admin.apps.length === 0) {
    try {
      // 1. Tentar ler do JSON direto na variável de ambiente (FIREBASE_SERVICE_ACCOUNT_KEY)
      if (ENV.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const serviceAccount = JSON.parse(ENV.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: ENV.FIREBASE_PROJECT_ID || serviceAccount.project_id,
        });
        console.log('✅ [Firebase] Conectado via FIREBASE_SERVICE_ACCOUNT_KEY (env)');
      }
      // 2. Tentar ler de arquivo apontado por FIREBASE_SERVICE_ACCOUNT_PATH
      else if (ENV.FIREBASE_SERVICE_ACCOUNT_PATH) {
        const resolvedPath = path.resolve(process.cwd(), ENV.FIREBASE_SERVICE_ACCOUNT_PATH);
        if (fs.existsSync(resolvedPath)) {
          const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
          const projectId = serviceAccount.project_id || (ENV.FIREBASE_PROJECT_ID !== 'seu-projeto-firebase' ? ENV.FIREBASE_PROJECT_ID : undefined);
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId,
          });
          console.log(`✅ [Firebase] Conectado via arquivo: ${ENV.FIREBASE_SERVICE_ACCOUNT_PATH} (Projeto: ${projectId})`);
        } else {
          console.warn(`⚠️ [Firebase] Arquivo de credenciais não encontrado em: ${resolvedPath}. Tentando credenciais padrão...`);
          admin.initializeApp({
            projectId: ENV.FIREBASE_PROJECT_ID || undefined,
          });
        }
      }
      // 3. Fallback: Google Application Default Credentials ou Project ID
      else {
        admin.initializeApp({
          projectId: ENV.FIREBASE_PROJECT_ID || undefined,
        });
        console.log('ℹ️ [Firebase] Inicializado com credenciais padrão (ADC/Ambiente)');
      }
    } catch (error) {
      console.error('❌ [Firebase] Erro ao inicializar Firebase Admin:', error);
      throw error;
    }
  }

  firestoreInstance = getFirestore();
  // Configura para ignorar campos undefined
  firestoreInstance.settings({ ignoreUndefinedProperties: true });
  return firestoreInstance;
}

export const db = initFirebase();
