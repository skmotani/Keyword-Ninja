import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET - List all users
export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user || !['superadmin', 'admin'].includes(session.user.role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                email: true,
                name: true,
                image: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
        });

        return NextResponse.json({ success: true, users });
    } catch (error) {
        console.error('Failed to fetch users:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 });
    }
}

// PATCH - Update user role or status
export async function PATCH(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user || !['superadmin', 'admin'].includes(session.user.role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const body = await request.json();
        const { userId, role, isActive } = body;

        if (!userId) {
            return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 });
        }

        // Check target user
        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!targetUser) {
            return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
        }

        // Prevent modifying superadmin
        if (targetUser.role === 'superadmin') {
            return NextResponse.json({ success: false, error: 'Cannot modify superadmin' }, { status: 403 });
        }

        // Only superadmin can create admins
        if (role === 'admin' && session.user.role !== 'superadmin') {
            return NextResponse.json({ success: false, error: 'Only superadmin can create admins' }, { status: 403 });
        }

        const updateData: any = {};
        if (role !== undefined) updateData.role = role;
        if (isActive !== undefined) updateData.isActive = isActive;

        // If changing to user or admin, ensure they're active
        if (role && role !== 'pending') {
            updateData.isActive = true;
        }

        await prisma.user.update({
            where: { id: userId },
            data: updateData,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update user:', error);
        return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
    }
}

// DELETE - Remove user
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user || session.user.role !== 'superadmin') {
            return NextResponse.json({ success: false, error: 'Only superadmin can delete users' }, { status: 403 });
        }

        const body = await request.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 });
        }

        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (targetUser?.role === 'superadmin') {
            return NextResponse.json({ success: false, error: 'Cannot delete superadmin' }, { status: 403 });
        }

        await prisma.user.delete({ where: { id: userId } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete user:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete user' }, { status: 500 });
    }
}
