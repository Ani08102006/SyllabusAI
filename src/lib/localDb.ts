// LocalStorage-based pseudo-database
export const generateId = () => Math.random().toString(36).substring(2, 15);

export const getCollection = (collectionName: string) => {
  const data = localStorage.getItem(collectionName);
  return data ? JSON.parse(data) : [];
};

export const saveCollection = (collectionName: string, data: any[]) => {
  localStorage.setItem(collectionName, JSON.stringify(data));
};

export const addDoc = (collectionName: string, doc: any) => {
  const data = getCollection(collectionName);
  const newDoc = { id: generateId(), ...doc };
  data.push(newDoc);
  saveCollection(collectionName, data);
  return newDoc;
};

export const updateDoc = (collectionName: string, id: string, updates: any) => {
  const data = getCollection(collectionName);
  const index = data.findIndex((d: any) => d.id === id);
  if (index !== -1) {
    data[index] = { ...data[index], ...updates };
    saveCollection(collectionName, data);
  }
};

export const deleteDoc = (collectionName: string, id: string) => {
  const data = getCollection(collectionName);
  const newData = data.filter((d: any) => d.id !== id);
  saveCollection(collectionName, newData);
};

export const queryDocs = (collectionName: string, field: string, value: any) => {
  const data = getCollection(collectionName);
  return data.filter((d: any) => d[field] === value);
};
