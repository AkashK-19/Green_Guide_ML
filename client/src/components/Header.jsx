import React from 'react';
import { NavLink } from 'react-router-dom';
import '../styles/home.css'; 

function Header() {
  return (
    <header className="header">
      <div className="logo">
        <img src="/assets/plants/logo.svg" alt="Logo" />
        <span>GreenGuide</span>
      </div>
      <nav className="navbar">
        <ul>
          <li><NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Home</NavLink></li>
          <li><NavLink to="/plants" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Plants</NavLink></li>
          <li><NavLink to="/favorites" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Favorites</NavLink></li>
          <li><NavLink to="/ai-tools" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>AI Tools</NavLink></li>
          <li><NavLink to="/contact" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Contact</NavLink></li>
          <li><NavLink to="/subscribe" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Subscribe</NavLink></li>
        </ul>
      </nav>
    </header>
  );
}

export default Header;