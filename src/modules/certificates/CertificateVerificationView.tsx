import React, { useState } from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { dbStore } from '../../server/db/mockStore';
import { formatDate } from '../../lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, XCircle, Search, ShieldCheck, Award, ArrowLeft, Building2 } from 'lucide-react';

interface CertificateVerificationViewProps {
  initialCode?: string;
  onBackToApp?: () => void;
}

export const CertificateVerificationView: React.FC<CertificateVerificationViewProps> = ({
  initialCode = 'CERT-2026-000001',
  onBackToApp,
}) => {
  const [searchCode, setSearchCode] = useState(initialCode);
  const [queriedCode, setQueriedCode] = useState(initialCode);
  const state = dbStore.getState();

  const certificate = state.certificates.find(
    c => c.certificateCode.trim().toLowerCase() === queriedCode.trim().toLowerCase()
  );

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setQueriedCode(searchCode.trim().toUpperCase());
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="max-w-xl w-full space-y-6">
        {/* Brand & Back Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold">
              C
            </div>
            <span className="font-extrabold text-sm tracking-tight text-white">
              CPEP • Plateforme Officielle de Vérification
            </span>
          </div>

          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="text-xs text-brand-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Retour au Système
            </button>
          )}
        </div>

        {/* Verification Card */}
        <Card className="bg-slate-900/90 border-slate-800 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="text-center space-y-2 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/20 flex items-center justify-center mx-auto mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              Vérification d'Authenticité
            </h1>
            <p className="text-xs text-slate-400">
              Contrôlez l'authenticité d'un certificat d'aptitude délivré par le centre CPEP.
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleVerify} className="flex gap-2 mb-6">
            <Input
              placeholder="ex: CERT-2026-000001"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              className="bg-slate-800/90 border-slate-700 text-white font-mono uppercase text-center text-sm"
              required
            />
            <Button type="submit" variant="primary" icon={Search}>
              Vérifier
            </Button>
          </form>

          {/* Result Block */}
          {certificate && certificate.isValid ? (
            <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-100 space-y-4 animate-fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="font-extrabold text-sm text-emerald-300">
                    Certificat Authentique & Valide
                  </h3>
                  <span className="text-[11px] font-mono text-emerald-400/80">
                    Identifiant : {certificate.certificateCode}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-emerald-800/40 text-xs">
                <div className="flex justify-between py-1 border-b border-emerald-900/40">
                  <span className="text-slate-400">Titulaire :</span>
                  <span className="font-bold text-white text-sm">{certificate.learnerName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-emerald-900/40">
                  <span className="text-slate-400">Formation :</span>
                  <span className="font-bold text-white">{certificate.trainingTitle}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-emerald-900/40">
                  <span className="text-slate-400">Volume Horaire :</span>
                  <span className="font-semibold text-white">{certificate.trainingDurationHours} Heures</span>
                </div>
                <div className="flex justify-between py-1 border-b border-emerald-900/40">
                  <span className="text-slate-400">Mention :</span>
                  <span className="font-bold text-amber-400">{certificate.mention}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Date d'Émission :</span>
                  <span className="font-semibold text-white">{formatDate(certificate.issueDate)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-emerald-800/40 text-[11px] text-slate-400">
                <span>Signataire : {certificate.signatureName}</span>
                <Badge variant="success" size="sm">Certifié Conforme</Badge>
              </div>
            </div>
          ) : queriedCode ? (
            <div className="p-5 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-100 text-center space-y-2 animate-fade-in">
              <XCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <h3 className="font-bold text-sm text-rose-300">Certificat Introuvable ou Invalide</h3>
              <p className="text-xs text-rose-300/80">
                Aucun document officiel ne correspond au code <span className="font-mono font-bold text-white">"{queriedCode}"</span>.
                Veuillez vérifier l'identifiant saisi.
              </p>
            </div>
          ) : null}
        </Card>

        <p className="text-center text-[11px] text-slate-500">
          Nimba Consulting & Supports Technologique • Système Sécurisé de Traçabilité
        </p>
      </div>
    </div>
  );
};
