export const isAuthenticated = () => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='));
    return token ? true : false; 
};
  