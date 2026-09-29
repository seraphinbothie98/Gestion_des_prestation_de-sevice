import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { isValidPhoneNumber } from '../../lib/phoneValidation';
import { dbStore } from '../../server/db/mockStore';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { formatDate } from '../../lib/utils';
import { notificationHub } from '../../server/providers/NotificationProvider';
import {
  Bell, Mail, MessageSquare, Smartphone, Send,
  CheckCircle2, AlertTriangle, Info, Clock
} from 'lucide-react';

export const NotificationsView: React.FC = () => {
  const { currentTenant } = useAuth();
  const { showToast } = useNotification();
  const state = dbStore.getState();

  const [testChannel, setTestChannel] = useState<'SMS' | 'EMAIL' | 'WHATSAPP'>('SMS');
  const [testRecipient, setTestRecipient] = useState('+224 621 58 05 92');
  const [testMessage, setTestMessage] = useState('Bonjour ! Votre commande est prête chez Nimba Consulting & Supports Technologique (NICOST).');

  const handleSendTestNotification = async (e: React.FormEvent) => {
    e.preventDefault();

    if ((testChannel === 'SMS' || testChannel === 'WHATSAPP') && !isValidPhoneNumber(testRecipient, { allowEmpty: false, required: true })) {
      showToast('Erreur Numéro', `Le destinataire ${testChannel} doit être un numéro de téléphone valide sans lettres.`, 'DANGER');
      return;
    }

    const res = await notificationHub.broadcast(testChannel, {
      tenantId: currentTenant?.id || 't-001',
      recipient: testRecipient,
      title: 'Notification Test CMS',
      message: testMessage,
    });

    if (res.success) {
      showToast('Notification Envoyée', `Message test transmis via le canal ${testChannel}.`, 'SUCCESS');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-brand-500" />
            Centre de Notifications & Fournisseurs Multi-Canaux
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Historique des alertes système et configuration des passerelles Email, SMS et WhatsApp.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Test Dispatcher Form */}
        <Card className="p-5 space-y-4">
          <CardHeader className="p-0 pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Send className="w-4 h-4 text-brand-500" />
              Simulateur d'Envoi Multi-Canal
            </CardTitle>
          </CardHeader>
          <form onSubmit={handleSendTestNotification} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Canal d'expédition
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['SMS', 'EMAIL', 'WHATSAPP'] as const).map(ch => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => {
                      setTestChannel(ch);
                      if (ch === 'EMAIL' && !testRecipient.includes('@')) {
                        setTestRecipient('contact@nicost-guinee.com');
                      } else if ((ch === 'SMS' || ch === 'WHATSAPP') && testRecipient.includes('@')) {
                        setTestRecipient('+224 621 58 05 92');
                      }
                    }}
                    className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                      testChannel === ch
                        ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            {testChannel === 'EMAIL' ? (
              <Input
                label="Adresse Email du destinataire"
                type="email"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                required
                placeholder="client@domaine.com"
              />
            ) : (
              <PhoneInput
                label={`Numéro de téléphone ${testChannel}`}
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                required
                placeholder="+224 6XX XX XX XX"
              />
            )}

            <Input
              label="Message / Texte à transmettre"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              required
            />

            <Button type="submit" variant="primary" icon={Send} className="w-full">
              Envoyer la Notification
            </Button>
          </form>
        </Card>

        {/* Live In-App Notifications History */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Journal des Notifications Internes Récentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {state.notifications.map(n => (
                <div key={n.id} className="p-4 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="mt-0.5">
                    {n.type === 'SUCCESS' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : n.type === 'WARNING' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    ) : (
                      <Info className="w-5 h-5 text-brand-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">{n.title}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">{formatDate(n.createdAt, 'dd/MM/yyyy HH:mm')}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
