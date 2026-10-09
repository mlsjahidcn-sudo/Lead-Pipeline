import React, { useState } from 'react';
import { Lead } from '../../types';
import { useCrm } from '../../context/CrmContext';
import { DollarSign, X } from 'lucide-react';

interface RecordPaymentModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({ lead, isOpen, onClose }) => {
  const { recordPayment } = useCrm();

  const [pkg, setPkg] = useState<'complete_admission' | 'guidance'>('complete_admission');
  const [paymentType, setPaymentType] = useState<'deposit' | 'package_fee' | 'instalment'>('deposit');
  const [amount, setAmount] = useState('50000');
  const [method, setMethod] = useState('Bank Transfer (City Bank)');
  const [receiptRef, setReceiptRef] = useState(`SICA-BD-${Date.now().toString().slice(-5)}`);

  if (!isOpen || !lead) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    recordPayment({
      leadId: lead.id,
      package: pkg,
      paymentType,
      amount: numAmount,
      currency: 'BDT',
      method,
      receiptRef,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">Record Student Payment</h2>
              <p className="text-xs text-slate-500">For {lead.full_name} · Moves to Paid Stage</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Package Selected *
            </label>
            <select
              value={pkg}
              onChange={(e) => setPkg(e.target.value as any)}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md bg-white"
            >
              <option value="complete_admission">Complete Admission & Visa Support Package</option>
              <option value="guidance">Scholarship Application Guidance Only</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Type
              </label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as any)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md bg-white"
              >
                <option value="deposit">Initial Deposit (e.g. 50k BDT)</option>
                <option value="package_fee">Full Package Fee</option>
                <option value="instalment">Stage 2 Instalment</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount (BDT) *
              </label>
              <input
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Method / Bank
            </label>
            <input
              type="text"
              required
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="e.g. City Bank Gulshan Branch / Cash at Office"
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Receipt / Transaction Reference *
            </label>
            <input
              type="text"
              required
              value={receiptRef}
              onChange={(e) => setReceiptRef(e.target.value)}
              className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-md"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-xs"
            >
              Record Payment & Advance Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
