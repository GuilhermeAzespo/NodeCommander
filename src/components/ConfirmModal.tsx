import React from "react";
import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";

export type ConfirmVariant = "danger" | "warning" | "info" | "success";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void; // Se não passar onCancel, atua como um Alert (apenas 1 botão)
  variant?: ConfirmVariant;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
  variant = "danger"
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const config = {
    danger: {
      btn: "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20",
      icon: <AlertTriangle className="w-6 h-6 text-red-500" />,
      bgIcon: "bg-red-500/10"
    },
    warning: {
      btn: "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20",
      icon: <AlertTriangle className="w-6 h-6 text-amber-500" />,
      bgIcon: "bg-amber-500/10"
    },
    info: {
      btn: "bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/20",
      icon: <Info className="w-6 h-6 text-blue-500" />,
      bgIcon: "bg-blue-500/10"
    },
    success: {
      btn: "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20",
      icon: <CheckCircle2 className="w-6 h-6 text-emerald-500" />,
      bgIcon: "bg-emerald-500/10"
    }
  };

  const currentConfig = config[variant];

  return (
    <div className="fixed inset-0 bg-bg-overlay/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-bg-secondary border border-border-color rounded-2xl w-full max-w-sm shadow-2xl animate-scale-up overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full shrink-0 ${currentConfig.bgIcon}`}>
              {currentConfig.icon}
            </div>
            <div className="flex-1 pt-1">
              <h3 className="text-lg font-bold text-text-primary leading-tight mb-2">{title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-bg-primary/50 border-t border-border-color flex gap-3 justify-end">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2.5 text-sm font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer rounded-xl"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors shadow-lg cursor-pointer ${currentConfig.btn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
