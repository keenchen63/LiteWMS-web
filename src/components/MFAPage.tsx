import React, { useState, useEffect } from 'react';
import { Shield, Lock, Key, CheckCircle, AlertCircle, Copy, Trash2, Plus, Power, Settings, X, ArrowRight } from 'lucide-react';
import { mfaApi, MFADeviceInfo } from '../services/api';

// 细粒度设置开关组件
const SettingToggle: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}> = ({ label, checked, onChange, disabled }) => {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-slate-700">{label}</span>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"></div>
      </label>
    </div>
  );
};

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
  // status 变量已移除，直接使用 devices.length 来判断 MFA 状态
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'password' | 'mfa'>('mfa');
  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [showAddDeviceDialog, setShowAddDeviceDialog] = useState(false);
  const [addDeviceStep, setAddDeviceStep] = useState<'name' | 'scan'>('name');
  const [mfaSettings, setMfaSettings] = useState<{
    inbound: boolean;
    outbound: boolean;
    transfer: boolean;
    adjust: boolean;
    category_create: boolean;
    category_update: boolean;
    category_delete: boolean;
    warehouse_create: boolean;
    warehouse_update: boolean;
    warehouse_delete: boolean;
  }>({
    inbound: true,
    outbound: false,
    transfer: true,
    adjust: true,
    category_create: true,
    category_update: true,
    category_delete: true,
    warehouse_create: true,
    warehouse_update: true,
    warehouse_delete: true,
  });

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
      // 加载 MFA 状态
      await loadMFAStatus();
      // 设备列表已加载
    } catch (err: any) {
      // Token 无效或过期，清除并显示登录页面
      mfaApi.clearToken();
      setIsAuthenticated(false);
      checkStatus();
    }
  };
  
  const loadMFAStatus = async () => {
    try {
      const status = await mfaApi.getStatus();
      setMfaEnabled(status.mfa_enabled);
      if (status.mfa_settings) {
        setMfaSettings(status.mfa_settings);
      }
    } catch (err: any) {
      console.error('Failed to load MFA status:', err);
      // 默认启用
      setMfaEnabled(true);
    }
  };
  
  const loadMFASettings = async () => {
    try {
      const response = await mfaApi.getSettings();
      setMfaSettings(response.settings);
    } catch (err: any) {
      console.error('Failed to load MFA settings:', err);
    }
  };
  
  const handleUpdateSettings = async (key: string, value: boolean) => {
    if (!isAuthenticated) {
      setError('请先登录');
      setStep('login');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const updatedSettings = { ...mfaSettings, [key]: value };
      await mfaApi.updateSettings({ [key]: value });
      setMfaSettings(updatedSettings);
      setSuccess('配置已更新');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('认证已过期，请重新登录');
        setIsAuthenticated(false);
        mfaApi.clearToken();
        setStep('login');
      } else {
        setError(err.response?.data?.detail || '操作失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    try {
      const statusData = await mfaApi.getStatus();
      
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
      // 同时加载 MFA 状态和配置
      await loadMFAStatus();
      await loadMFASettings();
    } catch (err: any) {
      console.error('Failed to load devices:', err);
      setDevices([]);
    }
  };
  
  const handleToggleMFA = async (enabled: boolean) => {
    if (!isAuthenticated) {
      setError('请先登录');
      setStep('login');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await mfaApi.toggleMFA(enabled);
      setMfaEnabled(enabled);
      setSuccess(`MFA 已${enabled ? '启用' : '禁用'}`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('认证已过期，请重新登录');
        setIsAuthenticated(false);
        mfaApi.clearToken();
        setStep('login');
      } else {
        setError(err.response?.data?.detail || '操作失败，请重试');
      }
    } finally {
      setLoading(false);
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
      // 打开对话框并进入扫描步骤
      setShowAddDeviceDialog(true);
      setAddDeviceStep('scan');
      setSuccess('');
      // 刷新设备列表
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
      // 刷新设备列表
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
      await mfaApi.verifyMFA(verificationCode);
      setSuccess('MFA 验证成功！设备已添加');
      setVerificationCode('');
      setMfaSecret('');
      setQrCodeUrl('');
      setDeviceName('');
      // 关闭对话框
      setShowAddDeviceDialog(false);
      setAddDeviceStep('name');
      // 刷新设备列表
      await loadDevices();
      setTimeout(() => setSuccess(''), 2000);
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

  const handleCloseAddDeviceDialog = () => {
    setShowAddDeviceDialog(false);
    setAddDeviceStep('name');
    setDeviceName('');
    setQrCodeUrl('');
    setMfaSecret('');
    setVerificationCode('');
    setError('');
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
      <div className="max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto pt-8">
        <div className="bg-white rounded-xl shadow-xl p-6 md:p-8">
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
              
              {/* MFA 开关 */}
              <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Power size={18} className="text-blue-600" />
                      <span className="font-medium text-slate-900">MFA 验证（全局开关）</span>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">
                      {mfaEnabled ? 'MFA 验证已启用，所有写操作都需要操作 token（API 保护）' : 'MFA 验证已禁用，所有操作都不需要验证'}
                    </p>
                    <div className="text-xs text-slate-500 bg-white/50 p-2 rounded border border-slate-200">
                      <p className="font-medium mb-1">💡 说明：</p>
                      <ul className="list-disc list-inside space-y-1 text-slate-600">
                        <li>开启后，所有写操作（创建、更新、删除）都需要操作 token</li>
                        <li>操作 token 通过 MFA 验证获得，有效期 5 分钟</li>
                        <li>细粒度开关只控制是否显示验证对话框，不影响 API 保护</li>
                        <li>如果细粒度开关关闭但已有有效 token，不会再次要求验证</li>
                      </ul>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={mfaEnabled}
                      onChange={(e) => handleToggleMFA(e.target.checked)}
                      disabled={loading || devices.length === 0}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"></div>
                  </label>
                </div>
                {devices.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2">
                    请先添加至少一个 MFA 设备才能启用验证
                  </p>
                )}
              </div>
              
              {/* 细粒度 MFA 控制 */}
              {mfaEnabled && devices.length > 0 && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="text-md font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Settings size={18} className="text-blue-600" />
                    细粒度控制（用户体验设置）
                  </h3>
                  <div className="text-xs text-slate-600 mb-4 space-y-2">
                    <p>
                      为不同操作单独设置是否需要显示 MFA 验证对话框
                    </p>
                    <div className="bg-white/70 p-2 rounded border border-blue-200">
                      <p className="font-medium mb-1">📌 重要提示：</p>
                      <ul className="list-disc list-inside space-y-1 text-slate-600">
                        <li>细粒度开关只控制<strong>是否显示验证对话框</strong>，不影响 API 保护</li>
                        <li>如果开关<strong>关闭</strong>但已有有效 token，不会显示验证对话框</li>
                        <li>如果开关<strong>关闭</strong>但没有 token，仍需要验证（因为 API 需要 token）</li>
                        <li>如果开关<strong>开启</strong>，总是显示验证对话框</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {/* 库存操作组 */}
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-2">库存操作</h4>
                      <div className="space-y-2 pl-4">
                        <SettingToggle
                          label="入库提交"
                          checked={mfaSettings.inbound}
                          onChange={(checked) => handleUpdateSettings('inbound', checked)}
                          disabled={loading}
                        />
                        <SettingToggle
                          label="出库提交"
                          checked={mfaSettings.outbound}
                          onChange={(checked) => handleUpdateSettings('outbound', checked)}
                          disabled={loading}
                        />
                        <SettingToggle
                          label="库存调拨"
                          checked={mfaSettings.transfer}
                          onChange={(checked) => handleUpdateSettings('transfer', checked)}
                          disabled={loading}
                        />
                        <SettingToggle
                          label="库存调整"
                          checked={mfaSettings.adjust}
                          onChange={(checked) => handleUpdateSettings('adjust', checked)}
                          disabled={loading}
                        />
                      </div>
                    </div>
                    
                    {/* 品类管理组 */}
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-2">品类管理</h4>
                      <div className="space-y-2 pl-4">
                        <SettingToggle
                          label="创建品类"
                          checked={mfaSettings.category_create}
                          onChange={(checked) => handleUpdateSettings('category_create', checked)}
                          disabled={loading}
                        />
                        <SettingToggle
                          label="更新品类"
                          checked={mfaSettings.category_update}
                          onChange={(checked) => handleUpdateSettings('category_update', checked)}
                          disabled={loading}
                        />
                        <SettingToggle
                          label="删除品类"
                          checked={mfaSettings.category_delete}
                          onChange={(checked) => handleUpdateSettings('category_delete', checked)}
                          disabled={loading}
                        />
                      </div>
                    </div>
                    
                    {/* 仓库设置组 */}
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-2">仓库设置</h4>
                      <div className="space-y-2 pl-4">
                        <SettingToggle
                          label="创建仓库"
                          checked={mfaSettings.warehouse_create}
                          onChange={(checked) => handleUpdateSettings('warehouse_create', checked)}
                          disabled={loading}
                        />
                        <SettingToggle
                          label="更新仓库"
                          checked={mfaSettings.warehouse_update}
                          onChange={(checked) => handleUpdateSettings('warehouse_update', checked)}
                          disabled={loading}
                        />
                        <SettingToggle
                          label="删除仓库"
                          checked={mfaSettings.warehouse_delete}
                          onChange={(checked) => handleUpdateSettings('warehouse_delete', checked)}
                          disabled={loading}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
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

              {/* Add Device Button */}
              <div className="mt-6">
                {devices.length === 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
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
                <button
                  onClick={() => {
                    setShowAddDeviceDialog(true);
                    setAddDeviceStep('name');
                    setDeviceName('');
                    setError('');
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  添加新设备
                </button>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Device Wizard Dialog */}
      {showAddDeviceDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in">
            {/* Dialog Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Shield size={20} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">添加 MFA 设备</h2>
                  <p className="text-sm text-slate-500">
                    {addDeviceStep === 'name' && '步骤 1/2：输入设备名称'}
                    {addDeviceStep === 'scan' && '步骤 2/2：扫描二维码并验证'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseAddDeviceDialog}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Dialog Content */}
            <div className="p-6 space-y-6">
              {/* Step 1: Device Name */}
              {addDeviceStep === 'name' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-blue-900 mb-1">为设备命名</div>
                        <div className="text-sm text-blue-700">
                          为您的 MFA 设备起一个容易识别的名称，例如：iPhone、备用手机、工作电脑等。
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      设备名称 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && deviceName.trim()) {
                          handleSetupMFA();
                        }
                      }}
                      placeholder="例如：iPhone、备用手机、工作电脑等"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      autoFocus
                    />
                    <p className="mt-2 text-xs text-gray-500">为设备起一个容易识别的名称，方便后续管理</p>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                      <AlertCircle size={16} />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={handleCloseAddDeviceDialog}
                      className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSetupMFA}
                      disabled={loading || !deviceName.trim()}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      {loading ? '生成中...' : (
                        <>
                          下一步
                          <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Scan QR Code and Verify */}
              {addDeviceStep === 'scan' && qrCodeUrl && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-amber-900 mb-1">扫描二维码</div>
                        <div className="text-sm text-amber-700">
                          请使用您的身份验证器应用（如 Google Authenticator、Microsoft Authenticator）扫描下方二维码。
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center bg-white p-6 rounded-lg border-2 border-dashed border-gray-300">
                    <img src={qrCodeUrl} alt="MFA QR Code" className="border-2 border-gray-200 rounded-lg w-64 h-64" />
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
                      <code className="text-xs text-slate-600 break-all font-mono bg-white px-3 py-2 rounded border block">
                        {mfaSecret}
                      </code>
                      <p className="mt-2 text-xs text-gray-500">
                        如果无法扫描二维码，可以在身份验证器中选择"手动输入密钥"，然后粘贴上面的 Secret Key
                      </p>
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="font-medium text-blue-900 mb-1">验证设备</div>
                        <div className="text-sm text-blue-700 mb-3">
                          扫描二维码后，身份验证器应用会显示一个 6 位数字验证码。请在下方输入该验证码进行验证。
                        </div>
                        <div>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            value={verificationCode}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                              setVerificationCode(value);
                              setError('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && verificationCode.length === 6) {
                                handleVerifyMFA();
                              }
                            }}
                            className="w-full px-4 py-3 text-center text-2xl font-bold tracking-widest border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                            placeholder="000000"
                            autoFocus
                          />
                          {verificationCode.length > 0 && verificationCode.length < 6 && (
                            <p className="mt-2 text-xs text-amber-600">请输入完整的 6 位验证码</p>
                          )}
                        </div>
                      </div>
                    </div>
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

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setAddDeviceStep('name');
                        setError('');
                        setVerificationCode('');
                      }}
                      className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                    >
                      上一步
                    </button>
                    <button
                      onClick={handleVerifyMFA}
                      disabled={loading || verificationCode.length !== 6}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      {loading ? '验证中...' : (
                        <>
                          <CheckCircle size={18} />
                          完成验证
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

