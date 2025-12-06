'use client';

import { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import { Client, Competitor } from '@/types';

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    clientCode: '',
    name: '',
    domain: '',
    notes: '',
  });

  const [editFormData, setEditFormData] = useState({
    clientCode: '',
    name: '',
    domain: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [competitorsRes, clientsRes] = await Promise.all([
      fetch('/api/competitors'),
      fetch('/api/clients'),
    ]);
    const competitorsData = await competitorsRes.json();
    const clientsData = await clientsRes.json();
    setCompetitors(competitorsData);
    setClients(clientsData.filter((c: Client) => c.isActive));
    setLoading(false);
  }

  function getClientName(clientCode: string) {
    const client = clients.find(c => c.code === clientCode);
    return client ? `${client.code} - ${client.name}` : clientCode;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    await fetch('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    
    setFormData({ clientCode: '', name: '', domain: '', notes: '' });
    fetchData();
  }

  async function handleUpdate(id: string) {
    await fetch('/api/competitors', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...editFormData }),
    });
    
    setEditingId(null);
    fetchData();
  }

  async function toggleActive(competitor: Competitor) {
    await fetch('/api/competitors', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: competitor.id, isActive: !competitor.isActive }),
    });
    
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to permanently delete this competitor? This action cannot be undone.')) {
      return;
    }
    
    await fetch(`/api/competitors?id=${id}`, {
      method: 'DELETE',
    });
    
    fetchData();
  }

  function startEdit(competitor: Competitor) {
    setEditingId(competitor.id);
    setEditFormData({
      clientCode: competitor.clientCode,
      name: competitor.name,
      domain: competitor.domain,
      notes: competitor.notes || '',
    });
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div>
      <PageHeader 
        title="Competitor Master" 
        description="Track competitors for each client"
      />

      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Add New Competitor</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
            placeholder="Competitor Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            placeholder="Domain"
            value={formData.domain}
            onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
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
            Add Competitor
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active?</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {competitors.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No competitors yet. Add your first competitor above.
                </td>
              </tr>
            ) : (
              competitors.map((competitor) => (
                <tr key={competitor.id} className={!competitor.isActive ? 'bg-gray-50 opacity-60' : ''}>
                  {editingId === competitor.id ? (
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
                          value={editFormData.name}
                          onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                          className="w-full px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editFormData.domain}
                          onChange={(e) => setEditFormData({ ...editFormData, domain: e.target.value })}
                          className="w-full px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${competitor.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {competitor.isActive ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 space-x-2">
                        <button
                          onClick={() => handleUpdate(competitor.id)}
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getClientName(competitor.clientCode)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{competitor.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{competitor.domain}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${competitor.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {competitor.isActive ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        <button
                          onClick={() => startEdit(competitor)}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActive(competitor)}
                          className={competitor.isActive ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'}
                        >
                          {competitor.isActive ? 'Archive' : 'Unarchive'}
                        </button>
                        <button
                          onClick={() => handleDelete(competitor.id)}
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
