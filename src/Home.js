// Home.js - Completely refactored to stop blinking
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";
import SplashScreen from "./SplashScreen";

function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [dispatchStats, setDispatchStats] = useState({
    totalDispatches: 0,
    activeDispatches: 0,
    completedToday: 0,
    pendingDispatches: 0,
    totalDrivers: 0,
    availableDrivers: 0,
    onTimeRate: 0,
    totalParties: 0,
    totalBills: 0,
    totalGatepasses: 0,
    totalManualStickers: 0
  });
  
  const [toastMessage, setToastMessage] = useState(null);
  
  // Refs to prevent multiple renders
  const isInitialized = useRef(false);
  const loadTimeoutRef = useRef(null);
  const userRoleRef = useRef(null);

  // Static data that never changes
  const staticBaseCards = useMemo(() => [
    {
      path: "/barcode",
      title: "Generate Barcode",
      icon: "🔖",
      description: "Create unique barcodes for product tracking and inventory management",
      theoreticalInfo: "Barcodes encode product information in a visual pattern readable by scanners. Each barcode is unique and can store up to 20+ characters. Uses GS1-128 standards for supply chain compatibility.",
      details: "✓ GS1-128 Compliant\n✓ Unique identifiers\n✓ Instant scanning",
      stats: "Generate GS1-128 compliant barcodes",
      color: "#4CAF50",
      lightColor: "#E8F5E9"
    },
    {
      path: "/manual-sticker",
      title: "Manual Sticker Create",
      icon: "🏷️",
      description: "Create custom manual stickers for products, packages, and special labeling requirements",
      theoreticalInfo: "Create and print custom stickers manually with specific text, batch numbers, expiry dates, and other variable information for product labeling. Supports multiple formats and sizes.",
      details: "✓ Custom text & batch numbers\n✓ Multiple sizes & formats\n✓ Print ready output",
      stats: "Create manual stickers",
      color: "#FF9800",
      lightColor: "#FFF3E0"
    },
    {
      path: "/party-selection",
      title: "Create Party Bill",
      icon: "💰",
      description: "Generate professional invoices and track payment history",
      theoreticalInfo: "Automated billing system calculates taxes, applies discounts, and maintains financial records for accounting compliance. Supports GST calculations and digital signatures.",
      details: "✓ Automatic tax calculation\n✓ GST compliance\n✓ Digital signatures",
      stats: "Generate bills",
      color: "#FF5722",
      lightColor: "#FBE9E7"
    },
    {
      path: "/draft-packing",
      title: "Draft Packing List",
      icon: "📝",
      description: "Create and manage draft packing lists before final dispatch",
      theoreticalInfo: "Create preliminary packing lists, review items, make changes, and convert to final dispatch when ready. Reduces errors by allowing multiple review cycles before finalization.",
      details: "✓ Multiple review cycles\n✓ Easy modifications\n✓ Convert to final",
      stats: "Save drafts for later processing",
      color: "#607D8B",
      lightColor: "#ECEFF1"
    },
    {
      path: "/gatepass-generator",
      title: "Gatepass Creation",
      icon: "🚪",
      description: "Generate security gate passes for vehicle entry and exit with automated tracking",
      theoreticalInfo: "Digital gatepass system with QR code authentication, vehicle verification, and real-time security logging for warehouse/facility access control. Enhances security and compliance.",
      details: "✓ QR code authentication\n✓ Vehicle verification\n✓ Security logging",
      stats: "Generate gatepasses",
      color: "#3F51B5",
      lightColor: "#E8EAF6"
    },
    {
      path: "/gatepass-details",
      title: "Gatepass Details",
      icon: "📋",
      description: "View, track, and manage all generated gatepasses with detailed information",
      theoreticalInfo: "Centralized repository of all gatepasses with status tracking, search functionality, and detailed view of each gatepass including associated bills and dispatch information.",
      details: "✓ Centralized repository\n✓ Status tracking\n✓ Search functionality",
      stats: "View gatepasses",
      color: "#009688",
      lightColor: "#E0F2F1"
    },
  ], []);

  const adminManagerCard = useMemo(() => ({
    path: "/dispatch-details",
    title: "Dispatch Details",
    icon: "🚚",
    description: "Track shipments, manage delivery routes, and monitor fleet performance",
    theoreticalInfo: "Real-time tracking system with route optimization, delivery confirmation, and performance analytics. Uses GPS integration and automated status updates for complete visibility.",
    details: "✓ Real-time tracking\n✓ Route optimization\n✓ Performance analytics",
    stats: "Manage dispatches",
    color: "#9C27B0",
    lightColor: "#F3E5F5"
  }), []);

  const teamMemberCard = useMemo(() => ({
    path: "/user-dispatch-details",
    title: "Today Dispatch Details",
    icon: "📦",
    description: "View and track your assigned dispatches, update status, and manage delivery confirmations",
    theoreticalInfo: "User-friendly dispatch tracking interface that shows all dispatches assigned to you. Update delivery status, add completion notes, and submit proof of delivery in real-time.",
    details: "✓ View assigned dispatches\n✓ Update delivery status\n✓ Add completion notes\n✓ Upload delivery proof",
    stats: "View my dispatches",
    color: "#14B8A6",
    lightColor: "#E6FFFA"
  }), []);

  const adminOnlyCard = useMemo(() => ({
    path: "/management-dispatch",
    title: "Management Dispatch Details",
    icon: "📊",
    description: "Comprehensive management view of all dispatches with advanced analytics and reporting",
    theoreticalInfo: "Enterprise-level dispatch management dashboard providing real-time analytics, performance metrics, and detailed reporting across all dispatch operations. Includes historical data analysis and trend forecasting.",
    details: "✓ Advanced analytics\n✓ Performance metrics\n✓ Historical data analysis\n✓ Trend forecasting\n✓ Export reports",
    stats: "Analytics & reports",
    color: "#E91E63",
    lightColor: "#FCE4EC"
  }), []);

  const loadDashboardData = useCallback(() => {
    try {
      const savedDispatches = JSON.parse(localStorage.getItem("dispatches") || "[]");
      const savedParties = JSON.parse(localStorage.getItem("parties") || "[]");
      const savedBills = JSON.parse(localStorage.getItem("bills") || "[]");
      const savedGatepasses = JSON.parse(localStorage.getItem("gatepasses") || "[]");
      const savedManualStickers = JSON.parse(localStorage.getItem("manualStickers") || "[]");
      const today = new Date().toDateString();
      
      const completedToday = savedDispatches.filter(
        d => d.status === "completed" && new Date(d.completedDate).toDateString() === today
      ).length;
      
      const onTimeDeliveries = savedDispatches.filter(d => d.status === "completed" && d.onTime).length;
      const totalCompleted = savedDispatches.filter(d => d.status === "completed").length;
      const onTimeRate = totalCompleted > 0 ? (onTimeDeliveries / totalCompleted * 100).toFixed(1) : 0;
      
      setDispatchStats({
        totalDispatches: savedDispatches.length,
        activeDispatches: savedDispatches.filter(d => d.status === "active").length,
        completedToday: completedToday,
        pendingDispatches: savedDispatches.filter(d => d.status === "pending").length,
        totalDrivers: 15,
        availableDrivers: 8,
        onTimeRate: onTimeRate,
        totalParties: savedParties.length,
        totalBills: savedBills.length,
        totalGatepasses: savedGatepasses.length,
        totalManualStickers: savedManualStickers.length
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    setToastMessage({ message, type });
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
    loadTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const handleLogout = useCallback(() => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
    
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("userData");
    
    window.dispatchEvent(new Event('authChange'));
    setUser(null);
    showToast("Logged out successfully", 'info');
    
    setTimeout(() => {
      navigate("/login", { replace: true });
    }, 500);
  }, [navigate, showToast]);

  const handleNavigation = useCallback((path) => {
    navigate(path);
  }, [navigate]);

  // Get navigation cards based on user role - without stats that cause re-renders
  const getNavigationCards = useCallback(() => {
    const role = user?.role || user?.position || '';
    const normalizedRole = role.toLowerCase().trim();
    
    if (normalizedRole === 'administrator' || normalizedRole === 'administrative') {
      return [...staticBaseCards, adminManagerCard, teamMemberCard, adminOnlyCard];
    } 
    else if (normalizedRole === 'manager') {
      return [...staticBaseCards, adminManagerCard];
    } 
    else {
      // Team Member or any other role
      return [...staticBaseCards, teamMemberCard];
    }
  }, [user, staticBaseCards, adminManagerCard, teamMemberCard, adminOnlyCard]);

  // Effect for authentication - runs only once
  useEffect(() => {
    if (isInitialized.current) return;
    
    const authenticated = localStorage.getItem("isAuthenticated");
    const userData = localStorage.getItem("userData");
    
    if (authenticated === "true" && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        
        // Load data once
        loadDashboardData();
        isInitialized.current = true;
      } catch (error) {
        console.error("Error parsing user data:", error);
        navigate('/login', { replace: true });
      }
    } else if (authenticated !== "true") {
      navigate('/login', { replace: true });
    }
    
    const splashShown = sessionStorage.getItem("splashShown");
    if (splashShown) {
      setShowSplash(false);
    }
    
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [navigate, loadDashboardData]);

  // Effect to handle auth change events
  useEffect(() => {
    const handleAuthChange = () => {
      const authenticated = localStorage.getItem("isAuthenticated");
      if (authenticated !== "true") {
        setUser(null);
        isInitialized.current = false;
      } else {
        // Re-initialize if needed
        const userData = localStorage.getItem("userData");
        if (userData) {
          try {
            const parsedUser = JSON.parse(userData);
            setUser(parsedUser);
            loadDashboardData();
            isInitialized.current = true;
          } catch (error) {
            console.error("Error parsing user data:", error);
          }
        }
      }
    };
    
    window.addEventListener('authChange', handleAuthChange);
    return () => window.removeEventListener('authChange', handleAuthChange);
  }, [loadDashboardData]);

  if (showSplash) {
    return <SplashScreen onFinish={() => {
      sessionStorage.setItem("splashShown", "true");
      setShowSplash(false);
    }} duration={3000} />;
  }

  // Get current navigation cards
  const navigationCards = getNavigationCards();
  const userRole = user?.role || user?.position || "Team Member";
  const isAdminRole = userRole.toLowerCase().trim() === 'administrator' || userRole.toLowerCase().trim() === 'administrative';
  const isManagerRole = userRole.toLowerCase().trim() === 'manager';

  return (
    <div className="home-container-white">
      {toastMessage && (
        <div className={`toast-white ${toastMessage.type}`}>
          <div className="toast-content-white">
            <span className="toast-icon-white">
              {toastMessage.type === 'success' ? '✓' : toastMessage.type === 'error' ? '✗' : 'ℹ'}
            </span>
            <span className="toast-message-white">{toastMessage.message}</span>
          </div>
        </div>
      )}

      <div className="dashboard-white">
        <div className="header-white">
          <div className="header-content">
            <div className="header-left">
              <h1 className="title-white">
                <span className="title-gradient">DISPATCH MANAGEMENT SYSTEM</span>
              </h1>
              <p className="subtitle-white">
                Enterprise Logistics Management System
              </p>
            </div>
            <div className="header-right">
              <div className="user-info-card">
                <div className="user-avatar">
                  <span className="user-icon">
                    {isAdminRole ? '👑' : isManagerRole ? '📊' : '👤'}
                  </span>
                </div>
                <div className="user-details">
                  <span className="user-name">{user?.fullName || user?.username || 'User'}</span>
                  <span className="user-role" style={{
                    color: isAdminRole ? '#8B5CF6' : isManagerRole ? '#3B82F6' : '#10B981'
                  }}>
                    {userRole}
                  </span>
                </div>
              </div>
              <button onClick={handleLogout} className="logout-button-enhanced">
                <span className="logout-icon">🚪</span>
                <span className="logout-text">Logout</span>
              </button>
            </div>
          </div>
        </div>

        <div className="actions-section">
          <div className="actions-grid-enhanced">
            {navigationCards.map((card, index) => (
              <div 
                key={card.path}
                className="action-card-enhanced"
                onClick={() => handleNavigation(card.path)}
                style={{ 
                  animationDelay: `${index * 0.05}s`,
                  borderTopColor: card.color 
                }}
              >
                <div className="card-icon-section" style={{ backgroundColor: card.lightColor }}>
                  <span className="card-icon-enhanced" style={{ color: card.color }}>{card.icon}</span>
                </div>
                
                <div className="card-content-section">
                  <h3 className="card-title-enhanced">{card.title}</h3>
                  <p className="card-description-enhanced">{card.description}</p>
                  
                  <div className="card-badge" style={{ backgroundColor: card.lightColor, color: card.color }}>
                    {card.stats}
                  </div>
                </div>
                
                <div className="card-details-section">
                  <div className="theoretical-insight">
                    <div className="insight-icon">💡</div>
                    <div className="insight-content">
                      <div className="insight-label">Theoretical Insight</div>
                      <div className="insight-text">{card.theoreticalInfo}</div>
                    </div>
                  </div>
                  
                  <div className="feature-list">
                    {card.details.split('\n').map((feature, i) => (
                      <div key={i} className="feature-item">
                        <span className="feature-check">✓</span>
                        <span className="feature-text">{feature.replace('✓ ', '')}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="card-footer-enhanced">
                  <button className="launch-button" style={{ backgroundColor: card.color }}>
                    Launch Module
                    <span className="button-arrow">→</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="logout-floating">
        <button onClick={handleLogout} className="logout-floating-button" title="Logout">
          🚪
        </button>
      </div>
    </div>
  );
}

export default Home;