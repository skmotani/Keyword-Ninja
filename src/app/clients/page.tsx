'use client';

import { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import { Client } from '@/types';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    mainDomain: '',
    notes: '',
  });

  const [editFormData, setEditFormData] = useState({
    code: '',
    name: '',
    mainDomain: '',
    notes: '',
  });

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    const res = await fetch('/api/clients');
    const data = await res.json();
    setClients(data);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    
    setFormData({ code: '', name: '', mainDomain: '', notes: '' });
    fetchClients();
  }

  async function handleUpdate(id: string) {
    await fetch('/api/clients', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...editFormData }),
    });
    
    setEditingId(null);
    fetchClients();
  }

  async function toggleActive(client: Client) {
    await fetch('/api/clients', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: client.id, isActive: !client.isActive }),
    });
    
    fetchClients();
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to permanently delete this client? This action cannot be undone.')) {
      return;
    }
    
    await fetch(`/api/clients?id=${id}`, {
      method: 'DELETE',
    });
    
    fetchClients();
  }

  function startEdit(client: Client) {
    setEditingId(client.id);
    setEditFormData({
      code: client.code,
      name: client.name,
      mainDomain: client.mainDomain,
      notes: client.notes || '',
    });
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div>
      <PageHeader 
        title="Client Master" 
        description="Manage your client database"
      />

      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Add New Client</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input
            type="text"
            placeholder="Code (e.g. 01)"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            required
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            placeholder="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            placeholder="Main Domain"
            value={formData.mainDomain}
            onChange={(e) => setFormData({ ...formData, mainDomain: e.target.value })}
            required
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            placeholder="Notes (optional)"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
          >
            Add Client
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Main Domain</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active?</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No clients yet. Add your first client above.
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id} className={!client.isActive ? 'bg-gray-50 opacity-60' : ''}>
                  {editingId === client.id ? (
                    <>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editFormData.code}
                          onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value })}
                          className="w-full px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editFormData.name}
                          onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                          className="w-full px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editFormData.mainDomain}
                          onChange={(e) => setEditFormData({ ...editFormData, mainDomain: e.target.value })}
                          className="w-full px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${client.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {client.isActive ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 space-x-2">
                        <button
                          onClick={() => handleUpdate(client.id)}
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{client.code}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{client.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.mainDomain}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${client.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {client.isActive ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        <button
                          onClick={() => startEdit(client)}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActive(client)}
                          className={client.isActive ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'}
                        >
                          {client.isActive ? 'Archive' : 'Unarchive'}
                        </button>
                        <button
                          onClick={() => handleDelete(client.id)}
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
