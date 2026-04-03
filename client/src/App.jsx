import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Plants from './pages/Plants';
import PlantDetails from './pages/PlantDetails';
import Favorites from './pages/Favorites';
import Contact from './pages/Contact';
import Subscribe from './pages/Subscribe';
import Account from './pages/Account';
import NotFound from './pages/NotFound';
import AITools from './pages/AITools';

function Layout({ children }) {
    const shouldHideLayout = false;
    if (shouldHideLayout) return <>{children}</>;
    return (
        <>
            <Header />
            <main>{children}</main>
            <Footer />
        </>
    );
}

function App() {
    return (
        <Router>
            <ScrollToTop />
            <div className="App">
                <Layout>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/plants" element={<Plants />} />
                        <Route path="/plants/:plantId" element={<PlantDetails />} />
                        <Route path="/favorites" element={<Favorites />} />
                        <Route path="/contact" element={<Contact />} />
                        <Route path="/subscribe" element={<Subscribe />} />
                        <Route path="/subscribe/:planId" element={<Subscribe />} />
                        <Route path="/account" element={<Account />} />
                        <Route path="/ai-tools" element={<AITools />} />
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </Layout>
            </div>
        </Router>
    );
}

export default App;