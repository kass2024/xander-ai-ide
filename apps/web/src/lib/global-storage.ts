// Global storage using a simple approach
// This file will be imported by all API routes to ensure shared state

interface User {
  id: string;
  fullName: string;
  email: string;
  password: string;
  createdAt: string;
  isActive: boolean;
}

// Create a global storage object that persists across imports
declare global {
  var _userStorage: User[] | undefined;
}

// Initialize global storage if it doesn't exist
if (!global._userStorage) {
  global._userStorage = [
    {
      id: '1',
      fullName: 'Demo User',
      email: 'demo@xander.ai',
      password: 'demo123',
      createdAt: new Date().toISOString(),
      isActive: true
    }
  ];
  console.log('🔵 Initialized global user storage with demo user');
}

// Export functions that work with the global storage
export const addUser = (user: Omit<User, 'id' | 'createdAt' | 'isActive'>): User => {
  console.log('🔵 ADDING USER:', user.email);
  console.log('📊 Current users before:', global._userStorage?.length || 0);
  
  const newUser: User = {
    ...user,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    isActive: true
  };
  
  global._userStorage!.push(newUser);
  
  console.log('✅ USER ADDED:', newUser.email);
  console.log('📊 Current users after:', global._userStorage?.length || 0);
  console.log('👥 All users:', global._userStorage?.map(u => ({ id: u.id, email: u.email })));
  
  return newUser;
};

export const findUserByEmail = (email: string): User | undefined => {
  console.log('🔍 FINDING USER:', email);
  const user = global._userStorage?.find(u => u.email === email);
  console.log(user ? '✅ USER FOUND' : '❌ USER NOT FOUND');
  return user;
};

export const validateUser = (email: string, password: string): Omit<User, 'password'> | null => {
  console.log('🔐 VALIDATING USER:', email);
  const user = global._userStorage?.find(u => u.email === email && u.password === password);
  if (user) {
    console.log('✅ USER VALIDATION SUCCESS');
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  console.log('❌ USER VALIDATION FAILED');
  return null;
};

export const getAllUsers = (): Omit<User, 'password'>[] => {
  console.log('📊 GETTING ALL USERS');
  const users = global._userStorage?.map(user => {
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }) || [];
  
  console.log('📋 RETURNING USERS:', users.length);
  return users;
};

export const debugStorage = (): void => {
  console.log('🐛 DEBUG STORAGE:');
  console.log('Total users:', global._userStorage?.length || 0);
  global._userStorage?.forEach((user, index) => {
    console.log(`  ${index + 1}. ID: ${user.id}, Email: ${user.email}, Name: ${user.fullName}`);
  });
};

// Make sure we export the global storage for debugging
export const getRawStorage = (): User[] => {
  return global._userStorage || [];
};
