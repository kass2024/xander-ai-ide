// Global shared storage for users
// This ensures all API routes share the same user data

export interface User {
  id: string;
  fullName: string;
  email: string;
  password: string; // In production, this would be hashed
  createdAt: string;
  isActive: boolean;
}

// Global array that persists across API calls
const globalUsers: User[] = [
  {
    id: '1',
    fullName: 'Demo User',
    email: 'demo@xander.ai',
    password: 'demo123', // In production, this would be hashed
    createdAt: new Date().toISOString(),
    isActive: true
  }
];

// Export functions to manage users
export const addUser = (user: Omit<User, 'id' | 'createdAt' | 'isActive'>) => {
  console.log('🔵 Adding user:', user.email);
  
  const newUser: User = {
    ...user,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    isActive: true
  };
  
  globalUsers.push(newUser);
  console.log('✅ User added successfully. Total users:', globalUsers.length);
  console.log('📋 Current users:', globalUsers.map(u => ({ id: u.id, email: u.email })));
  
  return newUser;
};

export const findUserByEmail = (email: string) => {
  console.log('🔍 Looking for user:', email);
  const user = globalUsers.find(user => user.email === email);
  console.log(user ? '✅ User found' : '❌ User not found');
  return user;
};

export const validateUser = (email: string, password: string) => {
  console.log('🔐 Validating user:', email);
  const user = globalUsers.find(u => u.email === email && u.password === password);
  if (user) {
    console.log('✅ User validation successful');
    return { ...user, password: undefined }; // Don't return password
  }
  console.log('❌ User validation failed');
  return null;
};

export const getAllUsers = () => {
  console.log('📊 Getting all users. Total:', globalUsers.length);
  // Return users without passwords for security
  return globalUsers.map(user => ({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    createdAt: user.createdAt,
    isActive: user.isActive
  }));
};

// Debug function to check current state
export const debugUsers = () => {
  console.log('🐛 DEBUG - Current users in storage:');
  globalUsers.forEach((user, index) => {
    console.log(`  ${index + 1}. ID: ${user.id}, Email: ${user.email}, Name: ${user.fullName}`);
  });
  return globalUsers.length;
};
