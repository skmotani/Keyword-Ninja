'use client';

import { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import { Client, ManualKeyword } from '@/types';

export default function ManualKeywordsPage() {
  const [keywords, setKeywords] = useState<ManualKeyword[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    clientCode: '',
    keywordText: '',
    notes: '',
  });

  const [editFormData, setEditFormData] = useState({
    clientCode: '',
    keywordText: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [keywordsRes, clientsRes] = await Promise.all([
      fetch('/api/keywords'),
      fetch('/api/clients'),
    ]);
    const keywordsData = await keywordsRes.json();
    const clientsData = await clientsRes.json();
    setKeywords(keywordsData);
    setClients(clientsData.filter((c: Client) => c.isActive));
    setLoading(false);
  }

  function getClientName(clientCode: string) {
    const client = clients.find(c => c.code === clientCode);
    return client ? `${client.code} - ${client.name}` : clientCode;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    await fetch('/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    
    setFormData({ clientCode: '', keywordText: '', notes: '' });
    fetchData();
  }

  async function handleUpdate(id: string) {
    await fetch('/api/keywords', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...editFormData }),
    });
    
    setEditingId(null);
    fetchData();
  }

  async function toggleActive(keyword: ManualKeyword) {
    await fetch('/api/keywords', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: keyword.id, isActive: !keyword.isActive }),
    });
    
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to permanently delete this keyword? This action cannot be undone.')) {
      return;
    }
    
    await fetch(`/api/keywords?id=${id}`, {
      method: 'DELETE',
    });
    
    fetchData();
  }

  function startEdit(keyword: ManualKeyword) {
    setEditingId(keyword.id);
    setEditFormData({
      clientCode: keyword.clientCode,
      keywordText: keyword.keywordText,
      notes: keyword.notes || '',
    });
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div>
      <PageHeader 
        title="Keyword Manual Master" 
        description="Manage manually collected keywords from client interviews"
      />

      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Add New Keyword</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={formData.clientCode}
            onChange={(e) => setFormData({ ...formData, clientCode: e.target.value })}
            required
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select Client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.code}>
                {client.code} - {client.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Keyword"
            value={formData.keywordText}
            onChange={(e) => setFormData({ ...formData, keywordText: e.target.value })}
            required
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            placeholder="Notes (optional, e.g. from client interview)"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
          >
            Add Keyword
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keyword</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active?</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {keywords.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No keywords yet. Add your first keyword above.
                </td>
              </tr>
            ) : (
              keywords.map((keyword) => (
                <tr key={keyword.id} className={!keyword.isActive ? 'bg-gray-50 opacity-60' : ''}>
                  {editingId === keyword.id ? (
                    <>
                      <td className="px-6 py-4">
                        <select
                          value={editFormData.clientCode}
                          onChange={(e) => setEditFormData({ ...editFormData, clientCode: e.target.value })}
                          className="w-full px-2 py-1 border rounded"
                        >
                          {clients.map((client) => (
                            <option key={client.id} value={client.code}>
                              {client.code} - {client.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editFormData.keywordText}
                          onChange={(e) => setEditFormData({ ...editFormData, keywordText: e.target.value })}
                          className="w-full px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editFormData.notes}
                          onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                          className="w-full px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${keyword.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {keyword.isActive ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 space-x-2">
                        <button
                          onClick={() => handleUpdate(keyword.id)}
                          className="text-green-600 hover:text-green-800"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-gray-600 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getClientName(keyword.clientCode)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{keyword.keywordText}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{keyword.notes || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${keyword.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {keyword.isActive ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        <button
                          onClick={() => startEdit(keyword)}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActive(keyword)}
                          className={keyword.isActive ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'}
                        >
                          {keyword.isActive ? 'Archive' : 'Unarchive'}
                        </button>
                        <button
                          onClick={() => handleDelete(keyword.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
