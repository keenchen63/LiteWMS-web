import { useState, useCallback } from 'react';
import { mfaApi } from '../services/api';

export const useMFA = () => {
  const [showMFADialog, setShowMFADialog] = useState(false);
  const [mfaResolve, setMfaResolve] = useState<((value: boolean) => void) | null>(null);

  const requireMFA = useCallback(async (): Promise<boolean> => {
    // Check if MFA is set up
    try {
      const status = await mfaApi.getStatus();
      if (!status.mfa_set) {
        // MFA not set up, allow operation
        return true;
      }
    } catch (error) {
      // If check fails, allow operation
      return true;
    }

    // MFA is set up, require verification
    return new Promise((resolve) => {
      setShowMFADialog(true);
      setMfaResolve(() => resolve);
    });
  }, []);

  const handleMFAVerify = async (code: string): Promise<boolean> => {
    try {
      await mfaApi.verifyMFA(code);
      // 验证成功，resolve Promise 并关闭对话框
      if (mfaResolve) {
        const resolve = mfaResolve;
        setMfaResolve(null);
        setShowMFADialog(false);
        resolve(true);
      }
      return true;
    } catch (error: any) {
      // 验证失败，抛出错误以便 MFADialog 可以处理（特别是 429 错误）
      // 不 resolve Promise，保持对话框打开让用户重试
      // 不调用 mfaResolve(false)，这样 Promise 不会被 resolve
      throw error; // 重新抛出错误，让 MFADialog 可以捕获并处理
    }
  };

  const handleMFACancel = () => {
    if (mfaResolve) {
      mfaResolve(false);
      setMfaResolve(null);
    }
    setShowMFADialog(false);
  };

  return {
    showMFADialog,
    requireMFA,
    handleMFAVerify,
    handleMFACancel,
  };
};

