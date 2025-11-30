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
        console.log('[MFA] MFA not set up, allowing operation');
        return true;
      }
      
      // MFA is set up, require verification
      console.log('[MFA] MFA is set up, requiring verification');
      return new Promise((resolve) => {
        setShowMFADialog(true);
        setMfaResolve(() => resolve);
      });
    } catch (error: any) {
      // If check fails, log error and block operation for security
      console.error('[MFA] Failed to check MFA status:', error);
      
      // 检查是否是网络错误（如 CORS、连接失败等）
      if (error.response) {
        // API 返回了错误响应
        console.error('[MFA] API error:', error.response.status, error.response.data);
        // 如果是 401/403，可能是认证问题，但 MFA 状态检查不需要认证
        // 如果是其他错误，可能是服务器问题
        // 为了安全，我们要求 MFA 验证（如果后端不可用，用户会看到错误）
        return new Promise((resolve) => {
          setShowMFADialog(true);
          setMfaResolve(() => resolve);
        });
      } else if (error.request) {
        // 请求发送了但没有收到响应（网络问题、CORS 等）
        console.error('[MFA] Network error - no response received');
        // 网络错误时，为了安全，要求 MFA 验证
        // 如果后端真的不可用，验证会失败，用户会看到错误
        return new Promise((resolve) => {
          setShowMFADialog(true);
          setMfaResolve(() => resolve);
        });
      } else {
        // 其他错误
        console.error('[MFA] Unknown error:', error);
        // 为了安全，要求 MFA 验证
        return new Promise((resolve) => {
          setShowMFADialog(true);
          setMfaResolve(() => resolve);
        });
      }
    }
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

