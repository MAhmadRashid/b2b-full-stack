import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth, Auth, DecodedIdToken } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "antigravity-saas-188c1";

let adminApp: App | undefined;
let adminAuth: Auth | undefined;
let adminFirestore: Firestore | undefined;

try {
  if (getApps().length === 0) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
    } else {
      adminApp = initializeApp({
        projectId,
      });
    }
  } else {
    adminApp = getApps()[0];
  }

  adminAuth = getAuth(adminApp);
  adminFirestore = getFirestore(adminApp);
} catch (err: any) {
  console.warn("[Firebase Admin] Initialization notice:", err?.message || err);
}

export { adminApp, adminAuth, adminFirestore };

/**
 * Verifies a Firebase ID token transmitted via Authorization header or session cookie
 */
export async function verifyFirebaseIdToken(token: string): Promise<DecodedIdToken | null> {
  if (!token || !adminAuth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token, true);
    return decoded;
  } catch (error) {
    return null;
  }
}
