'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

// Import RichEditor dynamically to avoid SSR issues
const RichEditor = dynamic(() => import('./RichEditor'), { ssr: false });

export interface SectionData {
    id: string;
    type: string;
    title: string;
    content: string;
    order: number;
    isRequired?: boolean;
    isCollapsed?: boolean;
}

interface SectionEditorProps {
    sections: SectionData[];
    onChange: (sections: SectionData[]) => void;
    templateType: 'blog' | 'ecommerce';
}

const sectionIcons: Record<string, string> = {
    hero: '🎯',
    body: '📝',
    toc: '📋',
    faq: '❓',
    author: '👤',
    related: '🔗',
    product_grid: '🛒',
    category_desc: '📄',
    reviews: '⭐',
    filters: '🔍',
};

const SectionHeader: React.FC<{
    section: SectionData;
    isCollapsed: boolean;
    onToggle: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
}> = ({ section, isCollapsed, onToggle, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) => (
    <div
        className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${isCollapsed ? 'bg-gray-50 hover:bg-gray-100' : 'bg-indigo-50'
            }`}
        onClick={onToggle}
    >
        <div className="flex items-center gap-2">
            <span className="text-xl">{sectionIcons[section.type] || '📄'}</span>
            <span className="font-medium">{section.title}</span>
            {section.isRequired && (
                <span className="text-xs text-red-500">*Required</span>
            )}
        </div>
        <div className="flex items-center gap-2">
            <button
                onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                disabled={!canMoveUp}
                className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                title="Move Up"
            >
                ↑
            </button>
            <button
                onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                disabled={!canMoveDown}
                className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                title="Move Down"
            >
                ↓
            </button>
            <span className={`transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>
                ▼
            </span>
        </div>
    </div>
);

export default function SectionEditor({
    sections,
    onChange,
    templateType,
}: SectionEditorProps) {
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

    const toggleCollapse = (sectionId: string) => {
        setCollapsedSections((prev) => {
            const next = new Set(prev);
            if (next.has(sectionId)) {
                next.delete(sectionId);
            } else {
                next.add(sectionId);
            }
            return next;
        });
    };

    const updateSectionContent = (sectionId: string, content: string) => {
        onChange(
            sections.map((s) => (s.id === sectionId ? { ...s, content } : s))
        );
    };

    const moveSection = (index: number, direction: 'up' | 'down') => {
        const newSections = [...sections];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= sections.length) return;

        [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];

        // Update order values
        newSections.forEach((s, i) => {
            s.order = i;
        });

        onChange(newSections);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                    Page Sections ({sections.length})
                </h3>
                <div className="text-sm text-gray-500">
                    {templateType === 'blog' ? '📝 Blog Template' : '🛒 E-Commerce Template'}
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden divide-y">
                {sections.map((section, index) => {
                    const isCollapsed = collapsedSections.has(section.id);

                    return (
                        <div key={section.id} className="bg-white">
                            <SectionHeader
                                section={section}
                                isCollapsed={isCollapsed}
                                onToggle={() => toggleCollapse(section.id)}
                                onMoveUp={() => moveSection(index, 'up')}
                                onMoveDown={() => moveSection(index, 'down')}
                                canMoveUp={index > 0}
                                canMoveDown={index < sections.length - 1}
                            />

                            {!isCollapsed && (
                                <div className="p-4 bg-white">
                                    {section.type === 'hero' ? (
                                        <HeroEditor
                                            content={section.content}
                                            onChange={(content) => updateSectionContent(section.id, content)}
                                        />
                                    ) : section.type === 'faq' ? (
                                        <FAQEditor
                                            content={section.content}
                                            onChange={(content) => updateSectionContent(section.id, content)}
                                        />
                                    ) : (
                                        <RichEditor
                                            content={section.content}
                                            onChange={(content) => updateSectionContent(section.id, content)}
                                            placeholder={`Add content for ${section.title}...`}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Hero Section Editor
interface HeroData {
    title: string;
    subtitle: string;
    image: string;
    cta?: {
        text: string;
        url: string;
    };
}

const HeroEditor: React.FC<{
    content: string;
    onChange: (content: string) => void;
}> = ({ content, onChange }) => {
    const [heroData, setHeroData] = useState<HeroData>(() => {
        try {
            return JSON.parse(content) || { title: '', subtitle: '', image: '' };
        } catch {
            return { title: '', subtitle: '', image: '' };
        }
    });

    const updateHero = (field: keyof HeroData, value: string | { text: string, url: string }) => {
        const updated = { ...heroData, [field]: value };
        setHeroData(updated);
        onChange(JSON.stringify(updated));
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hero Title
                </label>
                <input
                    type="text"
                    value={heroData.title}
                    onChange={(e) => updateHero('title', e.target.value)}
                    placeholder="Enter compelling headline..."
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subtitle
                </label>
                <textarea
                    value={heroData.subtitle}
                    onChange={(e) => updateHero('subtitle', e.target.value)}
                    placeholder="Brief description or tagline..."
                    rows={2}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hero Image URL
                </label>
                <input
                    type="url"
                    value={heroData.image}
                    onChange={(e) => updateHero('image', e.target.value)}
                    placeholder="https://example.com/hero-image.jpg"
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
            </div>
        </div>
    );
};

// FAQ Section Editor
interface FAQItem {
    question: string;
    answer: string;
}

const FAQEditor: React.FC<{
    content: string;
    onChange: (content: string) => void;
}> = ({ content, onChange }) => {
    const [faqs, setFaqs] = useState<FAQItem[]>(() => {
        try {
            return JSON.parse(content) || [];
        } catch {
            return [];
        }
    });

    const updateFaqs = (updatedFaqs: FAQItem[]) => {
        setFaqs(updatedFaqs);
        onChange(JSON.stringify(updatedFaqs));
    };

    const addFaq = () => {
        updateFaqs([...faqs, { question: '', answer: '' }]);
    };

    const removeFaq = (index: number) => {
        updateFaqs(faqs.filter((_, i) => i !== index));
    };

    const updateFaq = (index: number, field: 'question' | 'answer', value: string) => {
        const updated = [...faqs];
        updated[index] = { ...updated[index], [field]: value };
        updateFaqs(updated);
    };

    return (
        <div className="space-y-4">
            {faqs.map((faq, index) => (
                <div key={index} className="border rounded-md p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">FAQ #{index + 1}</span>
                        <button
                            onClick={() => removeFaq(index)}
                            className="text-red-500 hover:text-red-700 text-sm"
                        >
                            Remove
                        </button>
                    </div>
                    <input
                        type="text"
                        value={faq.question}
                        onChange={(e) => updateFaq(index, 'question', e.target.value)}
                        placeholder="Question..."
                        className="w-full px-3 py-2 border rounded-md mb-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <textarea
                        value={faq.answer}
                        onChange={(e) => updateFaq(index, 'answer', e.target.value)}
                        placeholder="Answer..."
                        rows={3}
                        className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                </div>
            ))}
            <button
                onClick={addFaq}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
            >
                + Add FAQ
            </button>
        </div>
    );
};
