import React, { useState, useEffect } from 'react';
import { Shield, X, AlertCircle, Clock } from 'lucide-react';

interface MFADialogProps {
  show: boolean;
  onVerify: (code: string) => Promise<boolean>;
  onCancel: () => void;
  title?: string;
  message?: string;
}

export const MFADialog: React.FC<MFADialogProps> = ({
  show,
  onVerify,
  onCancel,
  title = 'MFA 验证',
  message = '请输入您的验证码以继续操作'
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // 处理冷却倒计时
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => {
        setCooldown(cooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (cooldown === 0 && rateLimited) {
      setRateLimited(false);
    }
  }, [cooldown, rateLimited]);

  // 当对话框关闭时重置状态
  useEffect(() => {
    if (!show) {
      setCode('');
      setError('');
      setRateLimited(false);
      setCooldown(0);
    }
  }, [show]);

  if (!show) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code || code.length !== 6) {
      setError('请输入6位验证码');
      return;
    }

    // 如果处于冷却期，阻止提交
    if (rateLimited || cooldown > 0) {
      return;
    }

    setError('');
    setVerifying(true);

    try {
      const success = await onVerify(code);
      if (success) {
        // 验证成功，清空输入框（对话框会自动关闭）
        setCode('');
        setError('');
        setRateLimited(false);
        setCooldown(0);
      } else {
        // 验证失败，显示错误但不清空输入框，让用户可以直接修改
        setError('验证码错误，请重试');
        // 不清空 code，让用户可以快速修改
      }
    } catch (err: any) {
      console.log('MFA verify error:', err); // 调试日志
      // 检查是否是 429 速率限制错误
      if (err?.response?.status === 429 || err?.status === 429) {
        console.log('Rate limit detected, setting cooldown'); // 调试日志
        setRateLimited(true);
        setCooldown(60); // 60 秒冷却期
        setError(err?.response?.data?.detail || err?.detail || '请求过于频繁，请稍后再试');
      } else {
        // 其他错误
        setError(err?.response?.data?.detail || err?.detail || '验证失败，请重试');
      }
      // 不清空 code，让用户可以快速修改
    } finally {
      setVerifying(false);
    }
  };

  const handleCancel = () => {
    setCode('');
    setError('');
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 m-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <Shield size={24} className="text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-slate-700 mb-6">{message}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              验证码（6位数字）
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(value);
                setError('');
              }}
              className={`w-full px-4 py-3 text-center text-2xl font-bold tracking-widest border-2 rounded-lg outline-none transition-colors ${
                error
                  ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
              }`}
              placeholder="000000"
              autoFocus
              disabled={verifying || rateLimited || cooldown > 0}
            />
            {error && (
              <div className={`flex items-center gap-2 mt-2 text-sm ${
                rateLimited ? 'text-orange-600' : 'text-red-600'
              }`}>
                {rateLimited ? <Clock size={16} /> : <AlertCircle size={16} />}
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={verifying}
              className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={verifying || code.length !== 6 || rateLimited || cooldown > 0}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {verifying ? '验证中...' : rateLimited ? `请等待 ${cooldown} 秒` : '验证'}
            </button>
          </div>
        </form>

        <p className="text-xs text-slate-500 mt-4 text-center">
          请从您的身份验证器应用（如 Google Authenticator）中获取验证码
        </p>
      </div>
    </div>
  );
};

