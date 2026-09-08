'use client';

import React, { useState } from 'react';
import { Expense } from '@/types';
import {
  Receipt,
  ChevronDown,
  ChevronUp,
  Trash2,
  Calendar,
  User,
  ShoppingBag,
  FileText,
} from 'lucide-react';

interface Props {
  expenses: Expense[];
  onExpenseDeleted: () => void;
}

export default function ExpenseHistory({ expenses, onExpenseDeleted }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterMemberId, setFilterMemberId] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette dépense du pot commun ?')) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        onExpenseDeleted();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  // Filtrage par payeur
  const filteredExpenses =
    filterMemberId === 'all'
      ? expenses
      : expenses.filter((e) => e.payerId === filterMemberId);

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-emerald-600" />
          <h3 className="font-extrabold text-sm sm:text-base text-gray-900">
            Historique des dépenses ({expenses.length})
          </h3>
        </div>

        {/* Filtre colocataire */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-semibold">Payé par :</span>
          <select
            value={filterMemberId}
            onChange={(e) => setFilterMemberId(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-700 focus:outline-none"
          >
            <option value="all">Tous les colocs</option>
            {Array.from(new Set(expenses.map((e) => e.payer.id))).map((pid) => {
              const payer = expenses.find((e) => e.payer.id === pid)?.payer;
              return (
                <option key={pid} value={pid}>
                  {payer?.avatar} {payer?.name}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {filteredExpenses.length === 0 ? (
        <div className="py-8 text-center text-xs text-gray-400">
          Aucune dépense enregistrée pour le moment.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredExpenses.map((expense) => {
            const isExpanded = expandedId === expense.id;
            const formattedDate = new Date(expense.date).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
            });

            return (
              <div
                key={expense.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50/50 transition-all hover:border-gray-300"
              >
                {/* En-tête de la carte de dépense */}
                <div
                  onClick={() => toggleExpand(expense.id)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 cursor-pointer gap-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl shadow-sm border border-gray-100">
                      {expense.payer.avatar}
                    </div>

                    <div>
                      <div className="font-bold text-xs sm:text-sm text-gray-900">
                        {expense.store || expense.title}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                        <span className="flex items-center gap-1 font-semibold text-gray-600">
                          <User className="h-3 w-3" /> {expense.payer.name}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {formattedDate}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-800">
                        Coloc: {expense.colocAmount.toFixed(2)} €
                      </span>
                      {expense.persoAmount > 0 && (
                        <span className="rounded-lg bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                          Perso: {expense.persoAmount.toFixed(2)} €
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-xs sm:text-sm font-black text-gray-900">
                        {expense.totalAmount.toFixed(2)} €
                      </div>
                    </div>

                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Détail accordéon des articles */}
                {isExpanded && (
                  <div className="border-t border-gray-200 bg-white p-3.5 space-y-3 animate-fadeIn">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Détail des articles ({expense.items?.length || 0})
                    </div>

                    <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
                      {expense.items?.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center justify-between py-1.5 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                it.isPersonal ? 'bg-blue-500' : 'bg-emerald-500'
                              }`}
                            />
                            <span className="font-semibold text-gray-800">
                              {it.name}
                            </span>
                            {it.quantity > 1 && (
                              <span className="text-gray-400 text-[10px]">
                                (x{it.quantity})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                it.isPersonal
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {it.isPersonal ? 'Perso' : 'Coloc'}
                            </span>
                            <span className="font-bold text-gray-900">
                              {it.totalPrice.toFixed(2)} €
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end pt-2 border-t border-gray-100">
                      <button
                        onClick={() => handleDelete(expense.id)}
                        disabled={deletingId === expense.id}
                        className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-semibold p-1 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingId === expense.id ? 'Suppression...' : 'Supprimer'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
