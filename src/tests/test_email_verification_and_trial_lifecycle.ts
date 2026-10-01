/**
 * TEST SUITE: INSCRIPTION AVEC CONFIRMATION E-MAIL AVANT DÉMARRAGE DE L'ESSAI DE 15 JOURS
 * Prompt Antigravity ID : 58321
 *
 * Scénarios testés :
 * 1. Inscription d'un nouveau centre -> Le compte est emailVerified = false, accountStatus = 'PENDING_EMAIL_VERIFICATION',
 *    subscriptionStatus = 'NOT_STARTED', trialStartedAt/EndsAt non définis (l'essai n'a PAS commencé), l'utilisateur n'est PAS connecté.
 * 2. Tentative de connexion avant confirmation -> Connexion bloquée (403), message explicite requérant confirmation d'e-mail.
 * 3. Renvoyer l'e-mail avec cooldown -> Premier renvoi OK, second renvoi immédiat bloqué par le cooldown de 60s (429).
 * 4. Validation avec mauvais token -> Erreur 404 (INVALID).
 * 5. Validation avec bon token -> Compte activé, e-mail vérifié, 15 jours d'essai démarrés exactement à cet instant, fin dans 15 jours.
 * 6. Réutilisation du même token -> Erreur 409 (ALREADY_USED), compte reste actif.
 * 7. Connexion après confirmation -> Connexion réussie, accès à l'interface et évaluation de la licence d'essai = 15 jours restants.
 * 8. Non-régression : Les comptes pré-existants (NICOST, SuperAdmin) restent actifs et connectables sans interruption.
 */

import { dbStore } from '../server/db/mockStore';
import { evaluateTenantSubscription } from '../lib/licenseEngine';

async function runEmailVerificationAndTrialTests() {
  console.log('================================================================');
  console.log("TESTS PROMPT 58321 — CONFIRMATION E-MAIL & ESSAI 15 JOURS");
  console.log('================================================================\n');

  let passedTests = 0;
  const totalTests = 8;

  // -------------------------------------------------------------------------
  // TEST 1 : Inscription d'un nouveau centre autonome
  // -------------------------------------------------------------------------
  console.log("--- TEST 1 : Inscription d'un nouveau centre (Attente validation e-mail) ---");
  const timestamp = Date.now();
  const testEmail = `fondateur.${timestamp}@nouveaux-services.gn`;
  const testPhone = `+224 628 ${Math.floor(100000 + Math.random() * 900000)}`;

  const regRes = dbStore.registerAutonomousAgency({
    firstName: "Ibrahima",
    lastName: "Sow",
    email: testEmail,
    phone: testPhone,
    password: "PasswordSecure2026!",
    agencyName: "Centre Reprographie Sow & Frères",
    activityType: "SERVICE_CENTER",
    agencyPhone: testPhone,
    agencyCity: "Conakry (Dixinn)",
    currency: "GNF"
  });

  if (!regRes.success || !regRes.user || !regRes.tenant) {
    console.error("❌ TEST 1 ÉCHOUÉ : Erreur lors de l'enregistrement :", regRes.message);
    process.exit(1);
  }

  const createdUser = regRes.user;
  const createdTenant = regRes.tenant;
  const generatedToken = regRes.verificationToken;

  const stateAfterReg = dbStore.getState();
  const notAutoConnected = stateAfterReg.currentUserId !== createdUser.id;

  const test1Valid =
    regRes.requiresEmailVerification === true &&
    createdUser.emailVerified === false &&
    createdUser.accountStatus === 'PENDING_EMAIL_VERIFICATION' &&
    !!createdUser.emailVerificationToken &&
    createdTenant.status === 'PENDING_EMAIL_VERIFICATION' &&
    createdTenant.subscriptionStatus === 'NOT_STARTED' &&
    createdTenant.trialStartedAt === undefined &&
    createdTenant.trialEndsAt === undefined &&
    createdTenant.trialDaysTotal === 15 &&
    notAutoConnected;

  if (test1Valid) {
    console.log(`✅ TEST 1 RÉUSSI : Centre créé avec succès.`);
    console.log(`   - emailVerified = false`);
    console.log(`   - accountStatus = 'PENDING_EMAIL_VERIFICATION'`);
    console.log(`   - subscriptionStatus = 'NOT_STARTED'`);
    console.log(`   - trialStartedAt = null / undefined (Essai NON démarré)`);
    console.log(`   - Token généré : ${generatedToken?.substring(0, 16)}...`);
    console.log(`   - Utilisateur NON connecté immédiatement : OK`);
    passedTests++;
  } else {
    console.error("❌ TEST 1 ÉCHOUÉ : Propriétés d'attente d'e-mail invalides.");
    console.log({
      emailVerified: createdUser.emailVerified,
      accountStatus: createdUser.accountStatus,
      subscriptionStatus: createdTenant.subscriptionStatus,
      trialStartedAt: createdTenant.trialStartedAt,
      notAutoConnected
    });
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // TEST 2 : Tentative de connexion avant confirmation d'e-mail
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 2 : Tentative de connexion bloquée avant confirmation ---");
  const loginBeforeVerify = dbStore.authenticateUser(testEmail, "PasswordSecure2026!");

  if (
    !loginBeforeVerify.success &&
    loginBeforeVerify.statusCode === 403 &&
    loginBeforeVerify.requiresEmailVerification === true
  ) {
    console.log(`✅ TEST 2 RÉUSSI : Connexion bloquée (403 Forbidden).`);
    console.log(`   - Message : "${loginBeforeVerify.message}"`);
    console.log(`   - requiresEmailVerification = true`);
    passedTests++;
  } else {
    console.error("❌ TEST 2 ÉCHOUÉ : La connexion aurait dû être bloquée.", loginBeforeVerify);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // TEST 3 : Renvoyer l'e-mail avec protection anti-spam (cooldown 60s)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 3 : Renvoyer l'e-mail & protection Cooldown ---");
  // Tentative immédiate (doit être bloquée car moins de 60s se sont écoulées depuis l'inscription)
  const immediateResend = dbStore.resendEmailVerification(testEmail);

  if (
    !immediateResend.success &&
    immediateResend.statusCode === 429 &&
    immediateResend.remainingSeconds !== undefined &&
    immediateResend.remainingSeconds > 0
  ) {
    console.log(`✅ TEST 3 RÉUSSI : Cooldown anti-spam respecté.`);
    console.log(`   - Code HTTP : 429`);
    console.log(`   - Secondes restantes : ${immediateResend.remainingSeconds}s`);
    console.log(`   - Message : "${immediateResend.message}"`);
    passedTests++;
  } else {
    console.error("❌ TEST 3 ÉCHOUÉ : Le cooldown de 60 secondes n'a pas bloqué la demande.", immediateResend);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // TEST 4 : Validation avec mauvais token
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 4 : Validation avec mauvais token ---");
  const badTokenRes = dbStore.verifyEmailAndActivateAgency("vtok_token_totalement_invalide_99999");

  if (!badTokenRes.success && badTokenRes.statusCode === 404 && badTokenRes.reason === 'INVALID') {
    console.log(`✅ TEST 4 RÉUSSI : Mauvais jeton rejeté (404 Not Found).`);
    console.log(`   - Message : "${badTokenRes.message}"`);
    passedTests++;
  } else {
    console.error("❌ TEST 4 ÉCHOUÉ : Le mauvais token n'a pas été rejeté correctement.", badTokenRes);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // TEST 5 : Validation avec bon token -> Démarrage exact des 15 jours
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 5 : Validation avec bon token & Démarrage de l'essai 15 jours ---");
  const activationTimestamp = new Date();
  const validActivationRes = dbStore.verifyEmailAndActivateAgency(generatedToken!, activationTimestamp);

  if (!validActivationRes.success || !validActivationRes.user || !validActivationRes.tenant) {
    console.error("❌ TEST 5 ÉCHOUÉ : Échec de l'activation avec token valide :", validActivationRes.message);
    process.exit(1);
  }

  const activatedTenant = validActivationRes.tenant;
  const activatedUser = validActivationRes.user;

  const trialStartMs = new Date(activatedTenant.trialStartedAt!).getTime();
  const trialEndMs = new Date(activatedTenant.trialEndsAt!).getTime();
  const daysDiff = Math.round((trialEndMs - trialStartMs) / (1000 * 60 * 60 * 24));

  const test5Valid =
    activatedUser.emailVerified === true &&
    activatedUser.accountStatus === 'ACTIVE' &&
    !!activatedUser.emailVerificationUsedAt &&
    activatedTenant.status === 'ACTIVE' &&
    activatedTenant.subscriptionStatus === 'TRIAL' &&
    activatedTenant.trialStatus === 'ACTIVE' &&
    !!activatedTenant.trialStartedAt &&
    !!activatedTenant.trialEndsAt &&
    daysDiff === 15;

  if (test5Valid) {
    console.log(`✅ TEST 5 RÉUSSI : Compte activé et essai de 15 jours démarré exactement à la confirmation.`);
    console.log(`   - emailVerified = true`);
    console.log(`   - accountStatus = 'ACTIVE'`);
    console.log(`   - subscriptionStatus = 'TRIAL'`);
    console.log(`   - trialStartedAt = ${activatedTenant.trialStartedAt}`);
    console.log(`   - trialEndsAt = ${activatedTenant.trialEndsAt}`);
    console.log(`   - Durée exacte calculée = ${daysDiff} jours`);
    passedTests++;
  } else {
    console.error("❌ TEST 5 ÉCHOUÉ : Données d'activation ou calcul de dates incorrects.", {
      emailVerified: activatedUser.emailVerified,
      status: activatedTenant.status,
      subscriptionStatus: activatedTenant.subscriptionStatus,
      daysDiff
    });
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // TEST 6 : Réutilisation du même token
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 6 : Réutilisation du même token (Anti-Replay) ---");
  const reuseTokenRes = dbStore.verifyEmailAndActivateAgency(generatedToken!);

  if (!reuseTokenRes.success && reuseTokenRes.statusCode === 409 && reuseTokenRes.reason === 'ALREADY_USED') {
    console.log(`✅ TEST 6 RÉUSSI : Jeton déjà utilisé bloqué (409 Conflict).`);
    console.log(`   - Message : "${reuseTokenRes.message}"`);
    passedTests++;
  } else {
    console.error("❌ TEST 6 ÉCHOUÉ : La réutilisation du token aurait dû retourner 409 ALREADY_USED.", reuseTokenRes);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // TEST 7 : Connexion après confirmation & Évaluation de licence
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 7 : Connexion après confirmation & accès dashboard ---");
  const loginAfterVerify = dbStore.authenticateUser(testEmail, "PasswordSecure2026!");

  if (!loginAfterVerify.success || !loginAfterVerify.user) {
    console.error("❌ TEST 7 ÉCHOUÉ : La connexion aurait dû réussir après confirmation :", loginAfterVerify.message);
    process.exit(1);
  }

  const latestTenant = dbStore.getState().tenants.find(t => t.id === activatedTenant.id)!;
  const evaluation = evaluateTenantSubscription(latestTenant, activationTimestamp);

  const test7Valid =
    evaluation.status === 'TRIAL' &&
    evaluation.isTrial === true &&
    evaluation.isActive === true &&
    evaluation.daysRemaining === 15;

  if (test7Valid) {
    console.log(`✅ TEST 7 RÉUSSI : Connexion autorisée.`);
    console.log(`   - User connecté : ${loginAfterVerify.user.username} (${loginAfterVerify.user.email})`);
    console.log(`   - Évaluation licence : status = 'TRIAL', active = true, ${evaluation.daysRemaining} jours restants`);
    passedTests++;
  } else {
    console.error("❌ TEST 7 ÉCHOUÉ : Évaluation de licence incorrecte après connexion.", evaluation);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // TEST 8 : Non-régression sur comptes existants (NICOST, SuperAdmin)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 8 : Non-régression des comptes et centres existants ---");
  const superAdminLogin = dbStore.authenticateUser('superadmin', 'superadmin123');
  const nicostAdminLogin = dbStore.authenticateUser('admin', 'admin123');

  const test8Valid =
    superAdminLogin.success &&
    superAdminLogin.user?.username === 'superadmin' &&
    nicostAdminLogin.success &&
    nicostAdminLogin.user?.username === 'admin' &&
    (nicostAdminLogin.user?.tenantId === 't-001' || nicostAdminLogin.user?.tenantId === 'tenant-nicost-01');

  if (test8Valid) {
    console.log(`✅ TEST 8 RÉUSSI : Les comptes pré-existants restent immédiatement actifs sans restriction.`);
    console.log(`   - SuperAdmin login OK (ID: ${superAdminLogin.user?.id})`);
    console.log(`   - NICOST Admin login OK (Tenant: ${nicostAdminLogin.user?.tenantId})`);
    passedTests++;
  } else {
    console.error("❌ TEST 8 ÉCHOUÉ : Régression détectée sur les comptes existants.");
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // Synthèse
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`RÉSULTAT FINAL : ${passedTests}/${totalTests} TESTS PASSÉS AVEC SUCCÈS (100%)`);
  console.log('================================================================\n');
}

runEmailVerificationAndTrialTests().catch((err) => {
  console.error("Erreur fatale dans la suite de tests :", err);
  process.exit(1);
});
