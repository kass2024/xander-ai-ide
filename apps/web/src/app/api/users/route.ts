import { NextResponse } from 'next/server';
import { getAllUsers, debugStorage } from '@/lib/global-storage';

export async function GET() {
  try {
    console.log('🔵 USERS API CALLED');
    
    // Debug current state
    debugStorage();
    
    // Get all users without passwords for security
    const users = getAllUsers();
    
    console.log('📊 Returning users:', users.length);
    console.log('👤 User list:', users.map(u => ({ id: u.id, email: u.email })));

    return NextResponse.json({
      users,
      total: users.length
    });
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
