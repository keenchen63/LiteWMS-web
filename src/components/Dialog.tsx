import React from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

export type DialogType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

interface DialogProps {
  type: DialogType;
  title: string;
  message: string;
  show: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  details?: string | React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  type,
  title,
  message,
  show,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  details
}) => {
  if (!show) return null;

  const getIcon = () => {
    const iconClass = "w-6 h-6";
    switch (type) {
      case 'success':
        return <CheckCircle className={`${iconClass} text-green-600`} />;
      case 'warning':
        return <AlertTriangle className={`${iconClass} text-yellow-600`} />;
      case 'error':
        return <AlertCircle className={`${iconClass} text-red-600`} />;
      case 'confirm':
        return <AlertCircle className={`${iconClass} text-blue-600`} />;
      default:
        return <Info className={`${iconClass} text-blue-600`} />;
    }
  };

  const getButtonColors = () => {
    switch (type) {
      case 'success':
        return 'bg-green-600 hover:bg-green-700';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700';
      case 'error':
        return 'bg-red-600 hover:bg-red-700';
      case 'confirm':
        return 'bg-blue-600 hover:bg-blue-700';
      default:
        return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 max-w-md w-full mx-4 animate-in fade-in zoom-in">
        <div className="flex items-start gap-4 mb-4">
          <div className={`p-2 rounded-full ${
            type === 'success' ? 'bg-green-100' :
            type === 'warning' ? 'bg-yellow-100' :
            type === 'error' ? 'bg-red-100' :
            'bg-blue-100'
          }`}>
            {getIcon()}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
            <p className="text-slate-600 text-sm">{message}</p>
            {details && (
              <div className="mt-3 bg-slate-50 rounded-lg p-3 text-sm text-slate-700 max-h-[300px] overflow-y-auto">
                {typeof details === 'string' ? (
                  <div className="space-y-1.5">
                    {details.split('\n').map((line, index) => (
                      <div key={index} className="py-0.5">
                        {line.trim() && (
                          <div className="flex items-start gap-2">
                            <span className="text-red-500 mt-0.5">•</span>
                            <span className="flex-1 break-words">{line.trim()}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  details
                )}
              </div>
            )}
          </div>
          {type !== 'confirm' && onCancel && (
            <button
              onClick={handleCancel}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>
        
        <div className="flex justify-end gap-3">
          {type === 'confirm' && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
            >
              {cancelText || '取消'}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 text-white rounded-lg font-medium transition-colors flex items-center gap-2 ${getButtonColors()}`}
          >
            {confirmText || (type === 'confirm' ? '确认' : '确定')}
          </button>
        </div>
      </div>
    </div>
  );
};

