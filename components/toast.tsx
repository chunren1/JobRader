"use client";

import { useState, useCallback, createContext, useContext } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let _id = 0;
let _setToasts: ((f: (prev: Toast[]) => Toast[]) => void) | null = null;

export function toast(message: string, type: ToastType = "info") {
  if (!_setToasts) return;
  const id = ++_id;
  _setToasts(prev => [...prev, { id, message, type }]);
  setTimeout(() => {
    _setToasts?.(prev => prev.filter(t => t.id !== id));
  }, 3000);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  _setToasts = setToasts;
  return (
    <>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(t => {
          const Icon = t.type === "success" ? CheckCircle2 : t.type === "error" ? AlertCircle : Info;
          const bg = t.type === "success" ? "bg-green-50 border-green-200 text-green-800" : t.type === "error" ? "bg-red-50 border-red-200 text-red-800" : "bg-blue-50 border-blue-200 text-blue-800";
          return (
            <div key={t.id} className={`pointer-events-auto animate-fade-in flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg ${bg}`}>
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
