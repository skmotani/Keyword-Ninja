'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface User {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    role: string;
    isActive: boolean;
    createdAt: string;
}

export default function AdminPage() {
    const { data: session } = useSession();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users');
            const data = await res.json();
            if (data.success) {
                setUsers(data.users);
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateUser = async (userId: string, updates: Partial<User>) => {
        setActionLoading(userId);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, ...updates }),
            });
            const data = await res.json();
            if (data.success) {
                setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
            }
        } catch (error) {
            console.error('Failed to update user:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'superadmin': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'admin': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'user': return 'bg-green-100 text-green-700 border-green-200';
            case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
            default: return 'bg-gray-100 text-gray-600 border-gray-200';
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-gray-500">Loading users...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">👤 Admin Panel</h1>
                    <p className="text-gray-500 mt-1">Manage users and access control</p>
                </div>
                <div className="text-sm text-gray-500">
                    Logged in as: <span className="font-medium">{session?.user?.email}</span>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                {['superadmin', 'admin', 'user', 'pending'].map(role => {
                    const count = users.filter(u => u.role === role).length;
                    return (
                        <div key={role} className="bg-white rounded-lg border p-4">
                            <div className="text-sm text-gray-500 capitalize">{role}</div>
                            <div className="text-2xl font-bold">{count}</div>
                        </div>
                    );
                })}
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">User</th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Role</th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Joined</th>
                            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        {user.image ? (
                                            <img src={user.image} alt="" className="w-8 h-8 rounded-full" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm">
                                                {user.name?.[0] || user.email[0].toUpperCase()}
                                            </div>
                                        )}
                                        <div>
                                            <div className="font-medium text-gray-900">{user.name || 'No name'}</div>
                                            <div className="text-sm text-gray-500">{user.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <select
                                        value={user.role}
                                        onChange={(e) => updateUser(user.id, { role: e.target.value })}
                                        disabled={actionLoading === user.id || user.role === 'superadmin'}
                                        className={`px-2 py-1 rounded-lg border text-sm ${getRoleBadgeColor(user.role)} ${user.role === 'superadmin' ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="user">User</option>
                                        <option value="admin">Admin</option>
                                        {user.role === 'superadmin' && <option value="superadmin">Super Admin</option>}
                                    </select>
                                </td>
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => updateUser(user.id, { isActive: !user.isActive })}
                                        disabled={actionLoading === user.id || user.role === 'superadmin'}
                                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${user.isActive
                                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                                            } ${user.role === 'superadmin' ? 'cursor-not-allowed opacity-50' : ''}`}
                                    >
                                        {user.isActive ? '✓ Active' : '✕ Inactive'}
                                    </button>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {user.role !== 'superadmin' && (
                                        <button
                                            onClick={() => {
                                                if (confirm(`Are you sure you want to delete ${user.email}?`)) {
                                                    fetch('/api/admin/users', {
                                                        method: 'DELETE',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ userId: user.id }),
                                                    }).then(() => fetchUsers());
                                                }
                                            }}
                                            className="text-red-500 hover:text-red-700 text-sm"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {users.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        No users yet. Users will appear here after they sign in.
                    </div>
                )}
            </div>

            {/* Help Text */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 mb-2">💡 How Access Control Works</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                    <li>• <strong>New users</strong>: Automatically get full access when signing in with Google</li>
                    <li>• <strong>User</strong>: Can access all features</li>
                    <li>• <strong>Admin</strong>: Can access Admin panel and manage users</li>
                    <li>• <strong>Super Admin</strong>: Full access, cannot be modified (shaktimotani@gmail.com)</li>
                    <li>• <strong>Inactive</strong>: Toggle to revoke access for any user</li>
                </ul>
            </div>
        </div>
    );
}
