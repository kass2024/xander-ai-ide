// Mock user storage for testing
// In production, this would be replaced with a database

export interface User {
  id: string;
  fullName: string;
  email: string;
  password: string; // In production, this would be hashed
  createdAt: string;
  isActive: boolean;
}

// Initial demo user
export const mockUsers: User[] = [
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
  const newUser: User = {
    ...user,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    isActive: true
  };
  mockUsers.push(newUser);
  return newUser;
};

export const findUserByEmail = (email: string) => {
  return mockUsers.find(user => user.email === email);
};

export const validateUser = (email: string, password: string) => {
  const user = findUserByEmail(email);
  if (user && user.password === password) {
    return { ...user, password: undefined }; // Don't return password
  }
  return null;
};
