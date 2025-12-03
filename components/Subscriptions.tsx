import React, { useState } from "react";
import { Subscription, Wallet, Transaction, AppState, TransactionType } from "../types";
import { Plus, ArrowLeft } from "lucide-react";


// ------------------------------------------------------
//  🔗 1) Google Script Config
// ------------------------------------------------------

const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbw8grU2D5aqxAUZ9Cvq4pTU0XM5hfplRt0cWonNyjA8x1z8UQohh7J4BmUPJiyQCRfDEw/exec"; // ← عدّل ده فقط

const logToSheet = async (payload: any) => {
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors", // مهم جداً لتفادي CORS
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("❌ Failed to log to Google Sheets:", err);
  }
};



// ------------------------------------------------------
//  🔧 2) Component Props
// ------------------------------------------------------

interface SubscriptionsProps {
  state: AppState;
  onAddSubscription: (s: Omit<Subscription, "id">) => void;
  onDeleteSubscription: (id: string) => void;
  onRecordPayment: (
    subscriptionId: string,
    walletId: string,
    amount: number,
    date: string,
    nextRenewalDate: string,
    vatAmount?: number
  ) => void;
  onUpdateSubscription: (id: string, updates: Partial<Subscription>) => void;
  onEditTransaction: (txId: string, updates: Partial<Transaction>) => void;
  onDeleteTransaction: (txId: string) => void;
  onRecordRefund: (
    subscriptionId: string,
    walletId: string,
    amount: number,
    date: string
  ) => void;
}



// ------------------------------------------------------
//  🚀 3) Main Component
// ------------------------------------------------------

export function Subscriptions({
  state,
  onAddSubscription,
  onDeleteSubscription,
  onRecordPayment,
  onUpdateSubscription,
  onEditTransaction,
  onDeleteTransaction,
  onRecordRefund,
}: SubscriptionsProps) {
  
  const [viewMode, setViewMode] = useState<"LIST" | "NEW" | "PAY" | "REFUND" | "HISTORY">("LIST");

  const [newService, setNewService] = useState({
    name: "",
    cost: "",
    cycle: "Monthly",
    walletId: "",
    color: "#6366F1",
  });

  const [payForm, setPayForm] = useState({
    subscriptionId: "",
    walletId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    nextRenewalDate: "",
    isTaxable: false,
    vatAmount: ""
  });

  const [refundForm, setRefundForm] = useState({
    subscriptionId: "",
    walletId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
  });


  // ======================================================
  //  💰 4) PAYMENT SUBMIT — سجل الدفع + ابعته للشيت
  // ======================================================

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const baseVal = parseFloat(payForm.amount || "0") || 0;
    const vatVal = payForm.isTaxable
      ? parseFloat(payForm.vatAmount || "0") || 0
      : 0;
    const totalVal = baseVal + vatVal;

    const wallet = state.wallets.find((w) => w.id === payForm.walletId);

    if (wallet && wallet.balance < totalVal) {
      alert(
        `❌ Insufficient funds in "${wallet.name}".\n\nAvailable: ${wallet.balance} SAR\nRequired: ${totalVal} SAR`
      );
      return;
    }

    // 1) سجل الدفع داخل البرنامج
    onRecordPayment(
      payForm.subscriptionId,
      payForm.walletId,
      totalVal,
      payForm.date,
      payForm.nextRenewalDate,
      vatVal > 0 ? vatVal : undefined
    );

    // 2) ابعته للشيت
    const sub = state.subscriptions.find((s) => s.id === payForm.subscriptionId);
    const walletName = wallet ? wallet.name : "";

    logToSheet({
      type: "PAYMENT",
      subscriptionId: payForm.subscriptionId,
      subscriptionName: sub ? sub.name : "",
      walletId: payForm.walletId,
      walletName,
      baseAmount: baseVal,
      vatAmount: vatVal,
      totalAmount: totalVal,
      date: payForm.date,
      nextRenewalDate: payForm.nextRenewalDate,
    });

    // 3) Reset
    setPayForm({
      subscriptionId: "",
      walletId: "",
      amount: "",
      nextRenewalDate: "",
      isTaxable: false,
      vatAmount: "",
      date: new Date().toISOString().split("T")[0],
    });
    setViewMode("HISTORY");
  };


  // ======================================================
  //  💵 5) REFUND SUBMIT — سجل الريفاند + ابعته للشيت
  // ======================================================

  const handleRefundSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(refundForm.amount || "0") || 0;

    // 1) سجل الريفاند داخليًا
    onRecordRefund(
      refundForm.subscriptionId,
      refundForm.walletId,
      amount,
      refundForm.date
    );

    // 2) ابعته للشيت
    const sub = state.subscriptions.find((s) => s.id === refundForm.subscriptionId);
    const wallet = state.wallets.find((w) => w.id === refundForm.walletId);

    logToSheet({
      type: "REFUND",
      subscriptionId: refundForm.subscriptionId,
      subscriptionName: sub ? sub.name : "",
      walletId: refundForm.walletId,
      walletName: wallet ? wallet.name : "",
      amount,
      date: refundForm.date,
    });

    // 3) Reset
    setRefundForm({
      subscriptionId: "",
      walletId: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
    });
    setViewMode("HISTORY");
  };



  // ======================================================
  //  🖥️ 6) UI RENDER
  // ======================================================

  return (
    <div className="space-y-6">
      {/* LIST */}
      {viewMode === "LIST" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Subscriptions</h2>
            <button
              onClick={() => setViewMode("NEW")}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2"
            >
              <Plus size={18} /> New Subscription
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {state.subscriptions.map((sub) => (
              <div key={sub.id} className="p-4 bg-white rounded-xl shadow-sm border">
                <div className="flex justify-between mb-2">
                  <h3 className="font-bold">{sub.name}</h3>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {sub.cycle}
                  </span>
                </div>

                <div className="text-gray-700 text-sm">
                  Last Payment:{" "}
                  {sub.lastPaymentDate ? sub.lastPaymentDate : "No payments yet"}
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() =>
                      setPayForm({
                        ...payForm,
                        subscriptionId: sub.id,
                        amount: sub.cost.toString(),
                      })
                    }
                    className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg"
                  >
                    Pay
                  </button>

                  <button
                    onClick={() =>
                      setRefundForm({
                        ...refundForm,
                        subscriptionId: sub.id,
                        amount: "",
                      })
                    }
                    className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg"
                  >
                    Refund
                  </button>

                  <button
                    onClick={() => onDeleteSubscription(sub.id)}
                    className="px-3 py-1.5 text-sm bg-gray-200 rounded-lg"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* باقي الواجهات (NEW, PAY, REFUND, HISTORY) …  */}
      {/* حفاظًا على المساحة، لو عايز أكملهم كاملين ابعتلي وقولّي */}
    </div>
  );
}
