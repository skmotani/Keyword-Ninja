'use client';

import { useState, useEffect } from 'react';
import { ApiCredential } from '@/types';
import PageHeader from '@/components/PageHeader';

type ModalMode = 'add' | 'edit' | null;
type CredentialCategory = 'dataforseo' | 'apikey' | 'custom';

const SERVICE_TYPE_LABELS: Record<string, string> = {
  DATAFORSEO: 'DataForSEO',
  SEO_SERP: 'SEO SERP',
  OPENAI: 'OpenAI',
  GEMINI: 'Gemini',
  GROK: 'Grok',
  GSC: 'Google Search Console',
  CUSTOM: 'Custom',
};

const SERVICE_TYPE_COLORS: Record<string, string> = {
  DATAFORSEO: 'bg-blue-100 text-blue-800',
  SEO_SERP: 'bg-purple-100 text-purple-800',
  OPENAI: 'bg-green-100 text-green-800',
  GEMINI: 'bg-yellow-100 text-yellow-800',
  GROK: 'bg-red-100 text-red-800',
  GSC: 'bg-orange-100 text-orange-800',
  CUSTOM: 'bg-gray-100 text-gray-800',
};

const apiPageHelp = {
  title: 'API & Service Credentials',
  description: 'Central hub for managing authentication tokens and passwords for all external services.',
  whyWeAddedThis: 'Securely managing API keys is crucial. This system separates the raw secrets (stored in Replit Secrets) from the metadata needed by the app (labels, service types).',
  examples: ['DataForSEO Username/Password', 'OpenAI API Key', 'Custom GSC Config'],
  nuances: 'The actual raw passwords/keys are NOT displayed here for security. You put the "Masked" version here just for reference, but the backend uses the secure environment variables.',
  useCases: [
    'Update DataForSEO credentials when they expire',
    'Switch between different OpenAI API keys',
    'Configure custom integrations'
  ]
};

const apiPageDescription = `
  This settings page allows you to configure the connection points to external services. 
  
  **Security Note:** 
  For security reasons, this application reads actual API secrets from the server's environment variables (Replit Secrets). 
  This UI is primarily for managing the *references* to those secrets and toggling them on/off, or providing specific overrides if configured to do so securely.

  **Data Flow:** 
  Local Config → API Handler → External Service (DataForSEO / OpenAI / etc.)
`;

export default function ApiCredentialsPage() {
  const [credentials, setCredentials] = useState<ApiCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [modalCategory, setModalCategory] = useState<CredentialCategory>('dataforseo');
  const [editingCredential, setEditingCredential] = useState<ApiCredential | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    label: '',
    serviceType: 'DATAFORSEO' as ApiCredential['serviceType'],
    authType: 'USERNAME_PASSWORD' as ApiCredential['authType'],
    username: '',
    passwordMasked: '',
    apiKeyMasked: '',
    customConfig: '',
    clientCode: '',
    notes: '',
    isActive: true,
  });

  useEffect(() => {
    fetchCredentials();
  }, []);

  async function fetchCredentials() {
    try {
      const res = await fetch('/api/api-credentials/list');
      const data = await res.json();
      setCredentials(data);
    } catch (error) {
      console.error('Failed to fetch credentials:', error);
    } finally {
      setLoading(false);
    }
  }

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function openAddModal(category: CredentialCategory) {
    setSubmitError(null);
    setModalCategory(category);
    setModalMode('add');
    setEditingCredential(null);

    if (category === 'dataforseo') {
      setFormData({
        label: '',
        serviceType: 'DATAFORSEO',
        authType: 'USERNAME_PASSWORD',
        username: '',
        passwordMasked: '',
        apiKeyMasked: '',
        customConfig: '',
        clientCode: '',
        notes: '',
        isActive: true,
      });
    } else if (category === 'apikey') {
      setFormData({
        label: '',
        serviceType: 'OPENAI',
        authType: 'API_KEY',
        username: '',
        passwordMasked: '',
        apiKeyMasked: '',
        customConfig: '',
        clientCode: '',
        notes: '',
        isActive: true,
      });
    } else {
      setFormData({
        label: '',
        serviceType: 'GSC',
        authType: 'CUSTOM',
        username: '',
        passwordMasked: '',
        apiKeyMasked: '',
        customConfig: '',
        clientCode: '',
        notes: '',
        isActive: true,
      });
    }
  }

  function openEditModal(credential: ApiCredential) {
    setSubmitError(null);
    setEditingCredential(credential);
    setModalMode('edit');

    if (credential.authType === 'USERNAME_PASSWORD') {
      setModalCategory('dataforseo');
    } else if (credential.authType === 'API_KEY') {
      setModalCategory('apikey');
    } else {
      setModalCategory('custom');
    }

    setFormData({
      label: credential.label,
      serviceType: credential.serviceType,
      authType: credential.authType,
      username: credential.username || '',
      passwordMasked: credential.passwordMasked || '',
      apiKeyMasked: credential.apiKeyMasked || '',
      customConfig: credential.customConfig || '',
      clientCode: credential.clientCode || '',
      notes: credential.notes || '',
      isActive: credential.isActive,
    });
  }

  function closeModal() {
    setModalMode(null);
    setEditingCredential(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    const payload = {
      ...formData,
      userId: 'admin',
    };

    try {
      let res;
      if (modalMode === 'add') {
        res = await fetch('/api/api-credentials/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else if (modalMode === 'edit' && editingCredential) {
        res = await fetch('/api/api-credentials/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingCredential.id, ...payload }),
        });
      }

      if (res && !res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save credential');
      }

      await fetchCredentials();
      closeModal();
    } catch (error) {
      console.error('Failed to save credential:', error);
      setSubmitError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  // ... (inside return)

  {
    modalMode && (
      <Modal
        mode={modalMode}
        category={modalCategory}
        formData={formData}
        setFormData={setFormData}
        onClose={closeModal}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        error={submitError}
      />
    )
  }

  async function handleToggleActive(id: string) {
    try {
      await fetch('/api/api-credentials/toggle-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      await fetchCredentials();
    } catch (error) {
      console.error('Failed to toggle active:', error);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch('/api/api-credentials/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setDeleteConfirm(null);
      await fetchCredentials();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  }

  const dataforseoCreds = credentials.filter(c => c.authType === 'USERNAME_PASSWORD');
  const apiKeyCreds = credentials.filter(c => c.authType === 'API_KEY');
  const customCreds = credentials.filter(c => c.authType === 'CUSTOM' || c.authType === 'OAUTH');

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="API Credentials Settings" />
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="API Credentials Settings"
        helpInfo={apiPageHelp}
        extendedDescription={apiPageDescription}
      />

      <div className="space-y-6">
        <CredentialBox
          title="DataForSEO Credentials"
          description="Username + Password authentication"
          credentials={dataforseoCreds}
          onAdd={() => openAddModal('dataforseo')}
          onEdit={openEditModal}
          onToggle={handleToggleActive}
          onDelete={(id) => setDeleteConfirm(id)}
          addButtonText="Add DataForSEO Credential"
          category="dataforseo"
        />

        <CredentialBox
          title="API Key Credentials"
          description="For OpenAI, SEO SERP, Gemini, Grok, and other API key services"
          credentials={apiKeyCreds}
          onAdd={() => openAddModal('apikey')}
          onEdit={openEditModal}
          onToggle={handleToggleActive}
          onDelete={(id) => setDeleteConfirm(id)}
          addButtonText="Add API Key Credential"
          category="apikey"
        />

        <CredentialBox
          title="Custom / GSC Credentials"
          description="For OAuth, JSON configs, or custom authentication"
          credentials={customCreds}
          onAdd={() => openAddModal('custom')}
          onEdit={openEditModal}
          onToggle={handleToggleActive}
          onDelete={(id) => setDeleteConfirm(id)}
          addButtonText="Add Custom Credential"
          category="custom"
        />
      </div>

      {modalMode && (
        <Modal
          mode={modalMode}
          category={modalCategory}
          formData={formData}
          setFormData={setFormData}
          onClose={closeModal}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          error={submitError}
        />
      )}

      {deleteConfirm && (
        <DeleteConfirmModal
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

function CredentialBox({
  title,
  description,
  credentials,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
  addButtonText,
  category,
}: {
  title: string;
  description: string;
  credentials: ApiCredential[];
  onAdd: () => void;
  onEdit: (cred: ApiCredential) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  addButtonText: string;
  category: CredentialCategory;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        <button
          onClick={onAdd}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
        >
          {addButtonText}
        </button>
      </div>

      <div className="overflow-x-auto">
        {credentials.length === 0 ? (
          <p className="text-gray-500 text-xs p-4">No credentials configured.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-2 py-1 font-medium text-gray-600">Label</th>
                <th className="text-left px-2 py-1 font-medium text-gray-600">Service</th>
                {category === 'dataforseo' && (
                  <>
                    <th className="text-left px-2 py-1 font-medium text-gray-600">Username</th>
                    <th className="text-left px-2 py-1 font-medium text-gray-600">Password</th>
                  </>
                )}
                {category === 'apikey' && (
                  <th className="text-left px-2 py-1 font-medium text-gray-600">API Key</th>
                )}
                {category === 'custom' && (
                  <th className="text-left px-2 py-1 font-medium text-gray-600">Config</th>
                )}
                <th className="text-left px-2 py-1 font-medium text-gray-600">Client</th>
                <th className="text-left px-2 py-1 font-medium text-gray-600">Notes</th>
                <th className="text-left px-2 py-1 font-medium text-gray-600">Active</th>
                <th className="text-left px-2 py-1 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {credentials.map((cred) => (
                <tr key={cred.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1 font-medium">{cred.label}</td>
                  <td className="px-2 py-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SERVICE_TYPE_COLORS[cred.serviceType]}`}>
                      {SERVICE_TYPE_LABELS[cred.serviceType]}
                    </span>
                  </td>
                  {category === 'dataforseo' && (
                    <>
                      <td className="px-2 py-1 font-mono text-gray-600">{cred.username || '-'}</td>
                      <td className="px-2 py-1 font-mono text-gray-600">{cred.passwordMasked || '-'}</td>
                    </>
                  )}
                  {category === 'apikey' && (
                    <td className="px-2 py-1 font-mono text-gray-600">{cred.apiKeyMasked || '-'}</td>
                  )}
                  {category === 'custom' && (
                    <td className="px-2 py-1 font-mono text-gray-600 max-w-[100px] truncate">
                      {cred.customConfig ? '****config' : '-'}
                    </td>
                  )}
                  <td className="px-2 py-1">{cred.clientCode || '-'}</td>
                  <td className="px-2 py-1 max-w-[100px] truncate">{cred.notes || '-'}</td>
                  <td className="px-2 py-1">
                    <button
                      onClick={() => onToggle(cred.id)}
                      className={`w-8 h-4 rounded-full transition-colors ${cred.isActive ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                    >
                      <span
                        className={`block w-3 h-3 bg-white rounded-full transition-transform ${cred.isActive ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                      />
                    </button>
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex gap-1">
                      <button
                        onClick={() => onEdit(cred)}
                        className="px-2 py-0.5 text-blue-600 hover:bg-blue-50 rounded text-[10px]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(cred.id)}
                        className="px-2 py-0.5 text-red-600 hover:bg-red-50 rounded text-[10px]"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Modal({
  mode,
  category,
  formData,
  setFormData,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: {
  mode: ModalMode;
  category: CredentialCategory;
  formData: {
    label: string;
    serviceType: ApiCredential['serviceType'];
    authType: ApiCredential['authType'];
    username: string;
    passwordMasked: string;
    apiKeyMasked: string;
    customConfig: string;
    clientCode: string;
    notes: string;
    isActive: boolean;
  };
  setFormData: React.Dispatch<React.SetStateAction<typeof formData>>;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  const title = mode === 'add' ? 'Add Credential' : 'Edit Credential';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Label *</label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              required
              disabled={isSubmitting}
            />
          </div>

          {category === 'apikey' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Service Type *</label>
              <select
                value={formData.serviceType}
                onChange={(e) => setFormData({ ...formData, serviceType: e.target.value as ApiCredential['serviceType'] })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                disabled={isSubmitting}
              >
                <option value="OPENAI">OpenAI</option>
                <option value="SEO_SERP">SEO SERP</option>
                <option value="GEMINI">Gemini</option>
                <option value="GROK">Grok</option>
              </select>
            </div>
          )}

          {category === 'custom' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Service Type *</label>
              <select
                value={formData.serviceType}
                onChange={(e) => setFormData({ ...formData, serviceType: e.target.value as ApiCredential['serviceType'] })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                disabled={isSubmitting}
              >
                <option value="GSC">Google Search Console</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>
          )}

          {category === 'dataforseo' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Service Type *</label>
                <select
                  value={formData.serviceType}
                  onChange={(e) => setFormData({ ...formData, serviceType: e.target.value as ApiCredential['serviceType'] })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  disabled={isSubmitting}
                >
                  <option value="DATAFORSEO">DataForSEO</option>
                  <option value="SEO_SERP">SEO SERP</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Username (masked) *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="e.g., user@example.com"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Password (masked) *</label>
                <input
                  type="text"
                  value={formData.passwordMasked}
                  onChange={(e) => setFormData({ ...formData, passwordMasked: e.target.value })}
                  placeholder="e.g., ****abcd"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </>
          )}

          {category === 'apikey' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">API Key (masked) *</label>
              <input
                type="text"
                value={formData.apiKeyMasked}
                onChange={(e) => setFormData({ ...formData, apiKeyMasked: e.target.value })}
                placeholder="e.g., sk-****abcd"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                required
                disabled={isSubmitting}
              />
            </div>
          )}

          {category === 'custom' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Custom Config (masked preview)</label>
              <textarea
                value={formData.customConfig}
                onChange={(e) => setFormData({ ...formData, customConfig: e.target.value })}
                placeholder="JSON config or description..."
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono h-20"
                disabled={isSubmitting}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Client Code (optional)</label>
            <input
              type="text"
              value={formData.clientCode}
              onChange={(e) => setFormData({ ...formData, clientCode: e.target.value })}
              placeholder="Leave empty for global credential"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm h-16"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded"
              disabled={isSubmitting}
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-1 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed`}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : (mode === 'add' ? 'Add' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-semibold mb-2">Delete Credential</h3>
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete this credential? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
