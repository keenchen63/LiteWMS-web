import React, { useState, useEffect } from 'react';
import { Shield, Lock, Key, CheckCircle, AlertCircle, Copy, X, Trash2, Plus } from 'lucide-react';
import { mfaApi, MFADeviceInfo } from '../services/api';

export const MFAPage: React.FC = () => {
  const [step, setStep] = useState<'login' | 'set-password' | 'main'>('login');
  const [password, setPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [devices, setDevices] = useState<MFADeviceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [status, setStatus] = useState<{ password_set: boolean; mfa_set: boolean; mfa_count: number } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'password' | 'mfa'>('mfa');

  useEffect(() => {
    // 检查是否有保存的 token，如果有则尝试自动登录
    const token = mfaApi.getToken();
    if (token) {
      // 验证 token 是否有效（通过尝试获取设备列表）
      verifyTokenAndLoad();
    } else {
      checkStatus();
    }
  }, []);

  const verifyTokenAndLoad = async () => {
    try {
      // 尝试获取设备列表来验证 token
      const response = await mfaApi.getDevices();
      // Token 有效，直接进入主页面
      setIsAuthenticated(true);
      setStep('main');
      setDevices(response.devices);
      // 同时获取状态
      const statusData = await mfaApi.getStatus();
      setStatus(statusData);
    } catch (err: any) {
      // Token 无效或过期，清除并显示登录页面
      mfaApi.clearToken();
      setIsAuthenticated(false);
      checkStatus();
    }
  };

  const checkStatus = async () => {
    try {
      const statusData = await mfaApi.getStatus();
      setStatus(statusData);
      
      // 状态检查：根据密码设置状态和认证状态决定显示哪个页面
      if (!statusData.password_set) {
        setStep('set-password');
        setIsAuthenticated(false);
      } else {
        // 检查是否有有效的 token
        const token = mfaApi.getToken();
        if (token) {
          // 有 token，尝试验证
          await verifyTokenAndLoad();
        } else {
          // 没有 token，显示登录页面
          setStep('login');
          setIsAuthenticated(false);
        }
      }
    } catch (err: any) {
      console.error('Failed to check status:', err);
      // 如果 API 调用失败，显示登录页面
      if (err.response) {
        setError(`无法连接到服务器: ${err.response.status}`);
      } else if (err.request) {
        setError('无法连接到服务器，请检查后端服务是否运行');
      } else {
        setError('检查状态失败，请稍后重试');
      }
      setStep('login');
      setIsAuthenticated(false);
    }
  };

  const loadDevices = async () => {
    try {
      const response = await mfaApi.getDevices();
      setDevices(response.devices);
    } catch (err: any) {
      console.error('Failed to load devices:', err);
      setDevices([]);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 6) {
      setError('密码长度至少6位');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      await mfaApi.setPassword(password);
      setSuccess('密码设置成功');
      setTimeout(() => {
        setStep('login');
        setPassword('');
        setConfirmPassword('');
        checkStatus();
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.detail || '设置密码失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // 验证：密码不能为空
    if (!password || password.trim() === '') {
      setError('请输入密码');
      return;
    }

    setLoading(true);
    
    try {
      // 使用新的登录接口：密码通过 POST body 传输（仍然建议使用 HTTPS）
      // 登录成功后获取 JWT token，后续操作使用 token 而不是密码
      const response = await mfaApi.login(password.trim());
      
      // 登录成功，获取到 token
      if (response.access_token) {
        setIsAuthenticated(true);
        setStep('main');
        setPassword('');
        setError('');
        // 登录成功后加载设备列表
        await loadDevices();
        const statusData = await mfaApi.getStatus();
        setStatus(statusData);
      } else {
        setIsAuthenticated(false);
        setError('登录失败，未获取到认证令牌');
      }
    } catch (err: any) {
      // 处理错误
      setIsAuthenticated(false);
      mfaApi.clearToken(); // 清除可能存在的无效 token
      
      if (err.response?.status === 401) {
        setError('密码错误，请重试');
      } else if (err.response?.status === 422) {
        setError('请求格式错误，请刷新页面重试');
      } else if (err.response) {
        setError(`验证失败: ${err.response.data?.detail || '未知错误'}`);
      } else if (err.request) {
        setError('无法连接到服务器，请检查后端服务是否运行');
      } else {
        setError('登录失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 检查：必须先认证才能修改密码
    if (!isAuthenticated) {
      setError('请先登录');
      setStep('login');
      return;
    }

    const token = mfaApi.getToken();
    if (!token) {
      setError('认证已过期，请重新登录');
      setIsAuthenticated(false);
      setStep('login');
      return;
    }

    setError('');
    setSuccess('');

    if (!oldPassword || oldPassword.trim() === '') {
      setError('请输入当前密码');
      return;
    }

    if (newPassword.length < 6) {
      setError('新密码长度至少6位');
      return;
    }

    if (newPassword.length > 72) {
      setError('新密码长度不能超过72个字符');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    setLoading(true);
    try {
      await mfaApi.changePassword(oldPassword.trim(), newPassword.trim());
      setSuccess('密码修改成功');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('当前密码错误或认证已过期');
        if (err.response?.data?.detail?.includes('credentials')) {
          setIsAuthenticated(false);
          mfaApi.clearToken();
          setStep('login');
        }
      } else {
        setError(err.response?.data?.detail || '修改密码失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetupMFA = async () => {
    // 检查：必须先认证才能设置 MFA
    if (!isAuthenticated) {
      setError('请先登录');
      setStep('login');
      return;
    }

    // 检查 token
    const token = mfaApi.getToken();
    if (!token) {
      setError('认证已过期，请重新登录');
      setIsAuthenticated(false);
      setStep('login');
      return;
    }

    if (!deviceName || deviceName.trim() === '') {
      setError('请输入设备名称');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // 使用 token 进行认证，添加新设备
      const response = await mfaApi.setupMFA(deviceName.trim());
      setMfaSecret(response.secret);
      setQrCodeUrl(response.qr_code_url);
      setSuccess('MFA 设备添加成功，请验证验证码');
      setDeviceName('');
      // 刷新状态和设备列表
      const statusData = await mfaApi.getStatus();
      setStatus(statusData);
      await loadDevices();
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('认证已过期，请重新登录');
        setIsAuthenticated(false);
        mfaApi.clearToken();
        setStep('login');
      } else {
        setError(err.response?.data?.detail || '添加 MFA 设备失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm('确定要删除此设备吗？删除后该设备将无法用于验证。')) {
      return;
    }

    setError('');
    setLoading(true);

    try {
      await mfaApi.deleteDevice(deviceId);
      setSuccess('设备删除成功');
      // 刷新状态和设备列表
      const statusData = await mfaApi.getStatus();
      setStatus(statusData);
      await loadDevices();
      // 如果删除的是当前显示的设备，清空显示
      if (qrCodeUrl) {
        setQrCodeUrl('');
        setMfaSecret('');
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('认证已过期，请重新登录');
        setIsAuthenticated(false);
        mfaApi.clearToken();
        setStep('login');
      } else {
        setError(err.response?.data?.detail || '删除设备失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMFA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('请输入6位验证码');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // If we have a secret from a newly added device, verify locally first
      // This helps catch issues immediately without waiting for database sync
      if (mfaSecret) {
        try {
          // Import pyotp-like verification (we'll use the API, but this is a fallback check)
          // Actually, let's just use the API but with better error handling
        } catch (localErr) {
          console.warn('Local verification failed, trying API:', localErr);
        }
      }
      
      await mfaApi.verifyMFA(verificationCode);
      setSuccess('MFA 验证成功！');
      setVerificationCode('');
      setMfaSecret('');
      setQrCodeUrl('');
      // 刷新状态和设备列表
      const statusData = await mfaApi.getStatus();
      setStatus(statusData);
      await loadDevices();
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || '验证码错误';
      setError(errorMsg);
      // If verification fails, don't clear the QR code so user can try again
      setVerificationCode('');
      console.error('MFA verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(mfaSecret);
    setSuccess('Secret 已复制到剪贴板');
    setTimeout(() => setSuccess(''), 2000);
  };

  if (step === 'set-password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <Lock size={32} className="text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">首次设置</h1>
            <p className="text-slate-500">请设置管理员密码</p>
          </div>

          <form onSubmit={handleSetPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                密码
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少6位"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                确认密码
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                <CheckCircle size={16} />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-3 rounded-lg font-medium transition-colors"
            >
              {loading ? '设置中...' : '设置密码'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <Shield size={32} className="text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">MFA 管理</h1>
            <p className="text-slate-500">请输入管理员密码</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                密码
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-3 rounded-lg font-medium transition-colors"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <Shield size={32} className="text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">MFA 管理</h1>
            <p className="text-slate-500">管理密码和 MFA 设置</p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
              <CheckCircle size={16} />
              <span>{success}</span>
            </div>
          )}

          <div className="space-y-6">
            {/* Tabs for separating Password and MFA */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('mfa')}
                  className={`${
                    activeTab === 'mfa'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  <Shield size={18} className="inline mr-2" />
                  MFA 设备管理
                </button>
                <button
                  onClick={() => setActiveTab('password')}
                  className={`${
                    activeTab === 'password'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  <Key size={18} className="inline mr-2" />
                  修改密码
                </button>
              </nav>
            </div>

            {/* Change Password Tab */}
            {activeTab === 'password' && (
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Key size={20} className="text-blue-600" />
                修改密码
              </h2>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    当前密码
                  </label>
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    新密码
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    确认新密码
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-2 rounded-lg font-medium transition-colors"
                >
                  {loading ? '修改中...' : '修改密码'}
                </button>
              </form>
            </div>
            )}

            {/* MFA Setup Tab */}
            {activeTab === 'mfa' && (
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Shield size={20} className="text-blue-600" />
                MFA 设备管理
              </h2>
              
              {/* Device List - Always show if there are devices */}
              {devices.length > 0 && (
                <div className="mb-6 space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle size={20} />
                      <span className="font-medium">已配置 {devices.length} 个 MFA 设备</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {devices.map((device) => (
                      <div key={device.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-gray-200">
                        <div className="flex-1">
                          <div className="font-medium text-slate-900">{device.name}</div>
                          {device.created_at && (
                            <div className="text-xs text-slate-500 mt-1">
                              添加时间: {new Date(device.created_at).toLocaleString('zh-CN')}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteDevice(device.id)}
                          disabled={loading}
                          className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="删除设备"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step-by-step guide for adding MFA device */}
              {!qrCodeUrl && (
                <div className="mb-6 space-y-4">
                  {devices.length === 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-blue-900 mb-1">开始设置 MFA</div>
                          <div className="text-sm text-blue-700">
                            为了增强账户安全性，请至少添加一个 MFA 设备。您可以添加多个设备作为备用。
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="text-sm font-medium text-slate-900 mb-3">添加设备步骤：</div>
                    <ol className="space-y-2 text-sm text-slate-700">
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">1</span>
                        <span>在下方输入设备名称（如：iPhone、备用手机等），点击"添加新设备"</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">2</span>
                        <span>使用身份验证器应用（如 Google Authenticator、Microsoft Authenticator）扫描显示的二维码</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">3</span>
                        <span>在身份验证器中输入显示的 6 位验证码进行验证</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">4</span>
                        <span>验证成功后，设备将添加到列表中，可用于后续的 MFA 验证</span>
                      </li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Add Device Form */}
              {!qrCodeUrl && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      设备名称 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      placeholder="例如：iPhone、备用手机、工作电脑等"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                    <p className="mt-1 text-xs text-gray-500">为设备起一个容易识别的名称，方便后续管理</p>
                  </div>
                  <button
                    onClick={handleSetupMFA}
                    disabled={loading || !deviceName.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    {loading ? '生成中...' : '添加新设备'}
                  </button>
                </div>
              )}

              {/* QR Code and Verification Step */}
              {qrCodeUrl && (
                <div className="mt-6 space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-amber-900 mb-1">步骤 2：扫描二维码</div>
                        <div className="text-sm text-amber-700">
                          请使用您的身份验证器应用扫描下方二维码。如果无法扫描，也可以手动输入 Secret Key。
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center bg-white p-4 rounded-lg border-2 border-dashed border-gray-300">
                    <img src={qrCodeUrl} alt="MFA QR Code" className="border-2 border-gray-200 rounded-lg max-w-xs" />
                  </div>
                  
                  {mfaSecret && (
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">备用 Secret Key：</label>
                        <button
                          onClick={copySecret}
                          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <Copy size={14} />
                          复制
                        </button>
                      </div>
                      <code className="text-xs text-slate-600 break-all font-mono bg-white px-2 py-1 rounded border block">
                        {mfaSecret}
                      </code>
                      <p className="mt-2 text-xs text-gray-500">如果无法扫描二维码，可以在身份验证器中选择"手动输入密钥"，然后粘贴上面的 Secret Key</p>
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="font-medium text-blue-900 mb-1">步骤 3：验证设备</div>
                        <div className="text-sm text-blue-700 mb-3">
                          扫描二维码后，身份验证器应用会显示一个 6 位数字验证码。请在下方输入该验证码进行验证。
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            value={verificationCode}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                              setVerificationCode(value);
                            }}
                            className="flex-1 px-4 py-2 text-center text-xl font-bold tracking-widest border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                            placeholder="000000"
                            autoFocus
                          />
                          <button
                            onClick={handleVerifyMFA}
                            disabled={loading || verificationCode.length !== 6}
                            className="px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
                          >
                            {loading ? '验证中...' : '验证'}
                          </button>
                        </div>
                        {verificationCode.length > 0 && verificationCode.length < 6 && (
                          <p className="mt-2 text-xs text-amber-600">请输入完整的 6 位验证码</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setQrCodeUrl('');
                      setMfaSecret('');
                      setVerificationCode('');
                      setDeviceName('');
                    }}
                    className="w-full text-sm text-gray-600 hover:text-gray-700 py-2"
                  >
                    取消添加
                  </button>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

