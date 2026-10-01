import { Tenant, SubscriptionStatus, SupportContactConfig, LicenseHistoryEvent } from '../types';
import { dbStore } from '../server/db/mockStore';

export interface TrialEvaluationResult {
  status: SubscriptionStatus;
  isTrial: boolean;
  isActive: boolean;
  isExpired: boolean;
  isSuspended: boolean;
  isClockRollbackDetected: boolean;
  daysRemaining: number;
  totalDays: number;
  progressPercent: number;
  startDate: string;
  endDate: string;
  warningLevel: 'NONE' | 'INFO' | 'WARNING' | 'DANGER' | 'EXPIRED';
  warningMessage: string;
  bannerMessage: string;
  supportContact: SupportContactConfig;
}

export const DEFAULT_SUPPORT_CONTACT: SupportContactConfig = {
  name: 'Direction Commerciale & Support Technique NICOST',
  phone: '+224 621 58 05 92',
  whatsapp: '+224 621 58 05 92',
  email: 'support@nicost-guinee.com',
  address: 'Kindia-Republique de Guinée',
  customMessage: 'Nos conseillers et techniciens NICOST sont à votre écoute pour vos prestations, formations et support technique.'
};

/**
 * Server-grade local evaluation of tenant subscription, trial period, and clock rollback protection.
 */
export function evaluateTenantSubscription(tenant: Tenant | null, overrideNow?: Date | number): TrialEvaluationResult {
  if (!tenant) {
    return {
      status: 'EXPIRED',
      isTrial: false,
      isActive: false,
      isExpired: true,
      isSuspended: false,
      isClockRollbackDetected: false,
      daysRemaining: 0,
      totalDays: 45,
      progressPercent: 100,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      warningLevel: 'EXPIRED',
      warningMessage: 'Aucun centre valide associé.',
      bannerMessage: 'Compte inactif.',
      supportContact: DEFAULT_SUPPORT_CONTACT,
    };
  }

  const supportContact = tenant.supportContact || tenant.settings?.supportContact || DEFAULT_SUPPORT_CONTACT;
  const now = overrideNow instanceof Date ? overrideNow.getTime() : typeof overrideNow === 'number' ? overrideNow : Date.now();
  const totalDays = tenant.trialDaysTotal || 45;
  const startedAtMs = new Date(tenant.trialStartedAt || tenant.createdAt).getTime();
  const endsAtMs = new Date(tenant.trialEndsAt || startedAtMs + totalDays * 24 * 60 * 60 * 1000).getTime();

  // Clock Rollback Detection (Anti-tampering)
  let isClockRollbackDetected = false;
  let referenceNow = now;

  if (tenant.lastSeenAt) {
    const lastSeenMs = new Date(tenant.lastSeenAt).getTime();
    // If the current system time is more than 2 minutes in the past compared to lastSeenAt
    if (now < lastSeenMs - 120000) {
      isClockRollbackDetected = true;
      referenceNow = lastSeenMs; // Freeze evaluation at highest known timestamp to prevent trial extension
    }
  }

  // Update lastSeenAt silently if system time progresses normally
  if (!isClockRollbackDetected) {
    tenant.lastSeenAt = new Date(now).toISOString();
  }

  const diffMs = endsAtMs - referenceNow;
  const rawDaysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, rawDaysRemaining);

  const elapsedMs = Math.max(0, referenceNow - startedAtMs);
  const totalMs = Math.max(1, endsAtMs - startedAtMs);
  const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100)));

  // If Status is explicitly ACTIVE
  if (tenant.subscriptionStatus === 'ACTIVE') {
    // Check if license has an expiration date
    if (tenant.licenseExpiresAt) {
      const licenseEndMs = new Date(tenant.licenseExpiresAt).getTime();
      if (referenceNow > licenseEndMs) {
        return {
          status: 'EXPIRED',
          isTrial: false,
          isActive: false,
          isExpired: true,
          isSuspended: false,
          isClockRollbackDetected,
          daysRemaining: 0,
          totalDays,
          progressPercent: 100,
          startDate: tenant.licenseActivatedAt || tenant.createdAt,
          endDate: tenant.licenseExpiresAt,
          warningLevel: 'EXPIRED',
          warningMessage: 'Votre licence annuelle est arrivée à expiration.',
          bannerMessage: 'Licence expirée.',
          supportContact,
        };
      }
    }

    return {
      status: 'ACTIVE',
      isTrial: false,
      isActive: true,
      isExpired: false,
      isSuspended: false,
      isClockRollbackDetected,
      daysRemaining: 9999,
      totalDays,
      progressPercent: 100,
      startDate: tenant.licenseActivatedAt || tenant.createdAt,
      endDate: tenant.licenseExpiresAt || 'Illimitée',
      warningLevel: 'NONE',
      warningMessage: 'Licence officielle active.',
      bannerMessage: 'Version Complète Activée',
      supportContact,
    };
  }

  // If Status is NOT_STARTED (Pending email verification)
  if (tenant.subscriptionStatus === 'NOT_STARTED') {
    return {
      status: 'NOT_STARTED',
      isTrial: true,
      isActive: false,
      isExpired: false,
      isSuspended: false,
      isClockRollbackDetected: false,
      daysRemaining: totalDays,
      totalDays,
      progressPercent: 0,
      startDate: tenant.trialStartedAt || tenant.createdAt,
      endDate: tenant.trialEndsAt || tenant.createdAt,
      warningLevel: 'INFO',
      warningMessage: 'En attente de confirmation de votre adresse e-mail pour démarrer vos 15 jours d\'essai.',
      bannerMessage: 'Confirmation d\'e-mail requise.',
      supportContact,
    };
  }

  // If Status is SUSPENDED
  if (tenant.subscriptionStatus === 'SUSPENDED') {
    return {
      status: 'SUSPENDED',
      isTrial: false,
      isActive: false,
      isExpired: false,
      isSuspended: true,
      isClockRollbackDetected,
      daysRemaining: 0,
      totalDays,
      progressPercent: 100,
      startDate: tenant.trialStartedAt || tenant.createdAt,
      endDate: tenant.trialEndsAt || tenant.createdAt,
      warningLevel: 'EXPIRED',
      warningMessage: 'Ce compte a été suspendu par l’administration centrale.',
      bannerMessage: 'Compte suspendu.',
      supportContact,
    };
  }

  // If Status is TRIAL
  if (tenant.subscriptionStatus === 'TRIAL') {
    if (diffMs <= 0 || daysRemaining <= 0) {
      return {
        status: 'EXPIRED',
        isTrial: true,
        isActive: false,
        isExpired: true,
        isSuspended: false,
        isClockRollbackDetected,
        daysRemaining: 0,
        totalDays,
        progressPercent: 100,
        startDate: tenant.trialStartedAt || tenant.createdAt,
        endDate: tenant.trialEndsAt || tenant.createdAt,
        warningLevel: 'EXPIRED',
        warningMessage: 'Votre période d\'essai de 45 jours est arrivée à son terme.',
        bannerMessage: 'Période d\'essai terminée.',
        supportContact,
      };
    }

    // Determine Progressive Warning Level
    let warningLevel: 'NONE' | 'INFO' | 'WARNING' | 'DANGER' = 'NONE';
    let warningMessage = `Version d'essai active (${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} restant${daysRemaining > 1 ? 's' : ''}).`;

    if (isClockRollbackDetected) {
      warningLevel = 'DANGER';
      warningMessage = "Une incohérence de date système a été détectée. Veuillez vérifier la date et l'heure de votre ordinateur.";
    } else if (daysRemaining <= 1) {
      warningLevel = 'DANGER';
      warningMessage = "Votre période d'essai expire demain.";
    } else if (daysRemaining <= 3) {
      warningLevel = 'WARNING';
      warningMessage = `Votre période d'essai expire dans ${daysRemaining} jours.`;
    } else if (daysRemaining <= 7) {
      warningLevel = 'WARNING';
      warningMessage = `Votre période d'essai expire dans ${daysRemaining} jours.`;
    } else if (daysRemaining <= 15) {
      warningLevel = 'INFO';
      warningMessage = `Votre période d'essai expire dans ${daysRemaining} jours.`;
    }

    return {
      status: 'TRIAL',
      isTrial: true,
      isActive: true,
      isExpired: false,
      isSuspended: false,
      isClockRollbackDetected,
      daysRemaining,
      totalDays,
      progressPercent,
      startDate: tenant.trialStartedAt || tenant.createdAt,
      endDate: tenant.trialEndsAt || tenant.createdAt,
      warningLevel,
      warningMessage,
      bannerMessage: `Version d'Essai — Il vous reste ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}`,
      supportContact,
    };
  }

  // Default fallback for EXPIRED
  return {
    status: 'EXPIRED',
    isTrial: true,
    isActive: false,
    isExpired: true,
    isSuspended: false,
    isClockRollbackDetected,
    daysRemaining: 0,
    totalDays,
    progressPercent: 100,
    startDate: tenant.trialStartedAt || tenant.createdAt,
    endDate: tenant.trialEndsAt || tenant.createdAt,
    warningLevel: 'EXPIRED',
    warningMessage: 'Période d\'essai terminée.',
    bannerMessage: 'Période d\'essai terminée.',
    supportContact,
  };
}

/**
 * Generate a cryptographically structured unique license key
 */
export function generateLicenseKey(tenantCode: string, plan: string = 'PRO'): string {
  const cleanCode = (tenantCode || 'CMS').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4);
  const randomPart1 = Math.floor(1000 + Math.random() * 9000);
  const randomPart2 = Math.floor(1000 + Math.random() * 9000);
  const year = new Date().getFullYear();
  return `CMS-${cleanCode}-${plan}-${randomPart1}-${randomPart2}-${year}`;
}
