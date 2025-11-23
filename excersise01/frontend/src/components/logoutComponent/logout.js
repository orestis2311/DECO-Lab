// import React from 'react';
// import { getDefaultSession } from '@inrupt/solid-client-authn-browser';

// const Logout = ({ onLogout }) => {
//   const handleLogout = async () => {
//     try {
//       await getDefaultSession().logout();
//       // Clear any auth query params
//       window.history.replaceState({}, document.title, "/");
//       if (onLogout) {
//         onLogout();
//       }
//     } catch (error) {
//       console.error('Logout error:', error);
//     }
//   };

//   return (
//     <button onClick={handleLogout} className="logout-btn">
//       Logout
//     </button>
//   );
// };

// export default Logout;

import React from 'react';
import { logout } from '@inrupt/solid-client-authn-browser';

const Logout = ({ onLogout }) => {
  const handleLogout = async () => {
    try {
      await logout();
      window.history.replaceState({}, document.title, "/");
      if (onLogout) onLogout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <button onClick={handleLogout} className="logout-btn">
      Logout
    </button>
  );
};

export default Logout;
