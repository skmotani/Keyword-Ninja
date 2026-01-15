'use client';

import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PageConfig, PageComment } from '@/lib/db'; // We need to export PageComment from db.ts (already done)

interface PageCommentsProps {
    pagePath: string;
}

export default function PageComments({ pagePath }: PageCommentsProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [comments, setComments] = useState<PageComment[]>([]);
    const [loading, setLoading] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchComments();
        }
    }, [isOpen, pagePath]);

    async function fetchComments() {
        setLoading(true);
        try {
            const res = await fetch(`/api/page-config?path=${encodeURIComponent(pagePath)}`);
            if (res.ok) {
                const data = await res.json();
                const sorted = (data.comments || []).sort((a: PageComment, b: PageComment) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                setComments(sorted);
            }
        } catch (error) {
            console.error('Failed to fetch comments', error);
        } finally {
            setLoading(false);
        }
    }

    async function saveComments(updatedComments: PageComment[]) {
        try {
            await fetch('/api/page-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: pagePath,
                    comments: updatedComments
                }),
            });
            setComments(updatedComments);
        } catch (error) {
            console.error('Failed to save comments', error);
            alert('Failed to save changes');
        }
    }

    const handleAdd = async () => {
        if (!newComment.trim()) return;

        const comment: PageComment = {
            id: uuidv4(),
            text: newComment,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const updated = [comment, ...comments];
        await saveComments(updated);
        setNewComment('');
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this comment?')) return;
        const updated = comments.filter(c => c.id !== id);
        await saveComments(updated);
    };

    const startEdit = (comment: PageComment) => {
        setEditingId(comment.id);
        setEditText(comment.text);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditText('');
    };

    const handleUpdate = async (id: string) => {
        if (!editText.trim()) return;

        const updated = comments.map(c => {
            if (c.id === id) {
                return { ...c, text: editText, updatedAt: new Date().toISOString() };
            }
            return c;
        });

        await saveComments(updated);
        setEditingId(null);
        setEditText('');
    };

    return (
        <div className="mt-2 border-t pt-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors focus:outline-none"
            >
                <span className={`transform transition-transform duration-200 mr-1 ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                Add Comments ({comments.length})
            </button>

            {isOpen && (
                <div className="mt-2 pl-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    {/* Add Form */}
                    <div className="mb-4 bg-gray-50 p-2 rounded border border-gray-200">
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Write a note..."
                            className="w-full text-[10px] p-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[60px]"
                        />
                        <div className="flex justify-end mt-1">
                            <button
                                onClick={handleAdd}
                                disabled={!newComment.trim()}
                                className="px-2 py-1 bg-indigo-600 text-white text-[10px] rounded hover:bg-indigo-700 disabled:opacity-50"
                            >
                                Add Comment
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    {loading ? (
                        <div className="text-[10px] text-gray-400 italic">Loading comments...</div>
                    ) : comments.length === 0 ? (
                        <div className="text-[10px] text-gray-400 italic">No comments yet.</div>
                    ) : (
                        <div className="space-y-2">
                            {comments.map(comment => (
                                <div key={comment.id} className="group relative bg-white p-2 rounded border border-gray-100 hover:border-gray-300 transition-colors">
                                    {editingId === comment.id ? (
                                        <div>
                                            <textarea
                                                value={editText}
                                                onChange={(e) => setEditText(e.target.value)}
                                                className="w-full text-[10px] p-1 border border-indigo-300 rounded focus:outline-none"
                                                rows={3}
                                            />
                                            <div className="flex justify-end gap-1 mt-1">
                                                <button onClick={cancelEdit} className="text-[10px] text-gray-500 hover:text-gray-700 px-1">Cancel</button>
                                                <button onClick={() => handleUpdate(comment.id)} className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium px-1">Save</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-[10px] text-gray-400">
                                                    {new Date(comment.createdAt).toLocaleString()}
                                                    {comment.updatedAt !== comment.createdAt && ' (edited)'}
                                                </span>
                                                <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                                                    <button onClick={() => startEdit(comment)} className="text-[10px] text-blue-400 hover:text-blue-600">Edit</button>
                                                    <button onClick={() => handleDelete(comment.id)} className="text-[10px] text-red-400 hover:text-red-600">Delete</button>
                                                </div>
                                            </div>
                                            <div className="text-[10px] text-gray-800 whitespace-pre-wrap leading-relaxed">
                                                {comment.text}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
