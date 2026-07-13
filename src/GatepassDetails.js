import React, { useState, useEffect, useRef } from 'react';
import './GatepassDetails.css';
import jsPDF from 'jspdf';

// Google Sheets configuration
const GOOGLE_SHEETS_CONFIG = {
  apiKey: process.env.REACT_APP_GOOGLE_API_KEY || 'AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk',
  sheetId: process.env.REACT_APP_SPREADSHEET_ID || '1s8cXaMtG2XSxdOu1Ecve5aLI2MQcbMjVsn6Sih4hItk',
  sheetName: 'Bills',
};

const GatepassDetails = ({ onBack, userRole, userData }) => {
  const [gatepassData, setGatepassData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [codes, setCodes] = useState({});

  // Role-based access control state
  const [roleInfo, setRoleInfo] = useState({
    role: 'viewer',
    accessLevel: 'viewer',
    message: ''
  });

  // Function to get role from multiple sources
  const getEffectiveRole = () => {
    // Priority 1: Direct prop
    if (userRole && userRole !== '') {
      console.log("Using userRole from prop:", userRole);
      return userRole;
    }

    // Priority 2: From userData prop
    if (userData && userData.role && userData.role !== '') {
      console.log("Using role from userData prop:", userData.role);
      return userData.role;
    }

    // Priority 3: From localStorage (userData)
    const storedUserData = localStorage.getItem('userData');
    if (storedUserData) {
      try {
        const parsed = JSON.parse(storedUserData);
        if (parsed.role && parsed.role !== '') {
          console.log("Using role from localStorage userData:", parsed.role);
          return parsed.role;
        }
      } catch (e) {
        console.error('Error parsing stored user data:', e);
      }
    }

    // Priority 4: From userRole in localStorage
    const storedRole = localStorage.getItem('userRole');
    if (storedRole && storedRole !== '') {
      console.log("Using role from localStorage userRole:", storedRole);
      return storedRole;
    }

    console.warn("No role found, defaulting to viewer");
    return 'viewer';
  };

  const handleBackNavigation = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  const isWithinLastTwoDays = (dateString) => {
    if (!dateString) return false;

    try {
      // Get today's date at midnight
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get yesterday's date
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      // Parse the gatepass date
      let gatepassDate;
      if (typeof dateString === 'string') {
        // Handle YYYY-MM-DD format
        if (dateString.includes('-')) {
          const [year, month, day] = dateString.split('-');
          gatepassDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else {
          gatepassDate = new Date(dateString);
        }
      } else {
        gatepassDate = new Date(dateString);
      }

      // Reset time to midnight for comparison
      gatepassDate.setHours(0, 0, 0, 0);

      // Check if date is today OR yesterday
      return gatepassDate.getTime() === today.getTime() ||
        gatepassDate.getTime() === yesterday.getTime();
    } catch (error) {
      console.error('Error checking date range:', error);
      return false;
    }
  };

  const isToday = (dateString) => {
    if (!dateString) return false;

    try {
      const gatepassDate = new Date(dateString);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      gatepassDate.setHours(0, 0, 0, 0);

      return gatepassDate.getTime() === today.getTime();
    } catch (error) {
      console.error('Error checking if today:', error);
      return false;
    }
  };

  const fetchGatepassData = async (accessLevel) => {
    setLoading(true);
    try {
      const { apiKey, sheetId, sheetName } = GOOGLE_SHEETS_CONFIG;
      let allRows = [];
      let pageToken = '';
      let hasMoreData = true;

      while (hasMoreData) {
        let url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!A:Z?key=${apiKey}&majorDimension=ROWS`;

        if (pageToken) {
          url += `&pageToken=${pageToken}`;
        }

        console.log(`Fetching page with token: ${pageToken || 'initial'}`);
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.values && data.values.length > 0) {
          if (allRows.length === 0) {
            allRows = [...data.values];
          } else {
            allRows = [...allRows, ...data.values.slice(1)];
          }
          console.log(`Fetched ${data.values.length} rows this page. Total: ${allRows.length}`);
        }

        if (data.nextPageToken) {
          pageToken = data.nextPageToken;
          console.log(`Next page token: ${pageToken}`);
        } else {
          hasMoreData = false;
          console.log("No more pages to fetch");
        }
      }

      console.log(`Total rows fetched across all pages: ${allRows.length}`);

      if (allRows.length > 0) {
        const headers = allRows[0];
        const rows = allRows.slice(1);

        const columnIndices = {
          billNumber: headers.findIndex(h => h === 'Bill Number'),
          partyName: headers.findIndex(h => h === 'Party Name'),
          billDate: headers.findIndex(h => h === 'Bill Date'),
          totalBoxes: headers.findIndex(h => h === 'Total Boxes'),
          totalBags: headers.findIndex(h => h === 'Total Bags'),
          totalPolybags: headers.findIndex(h => h === 'Total Polybags'),
          gatepassCreated: headers.findIndex(h => h === 'GATEPASS CREATED'),
          gatepassTime: headers.findIndex(h => h === 'GATEPASS CREATION TIME'),
          driverName: headers.findIndex(h => h === 'DRIVER NAME'),
          driverContact: headers.findIndex(h => h === 'DRIVER CONTACT'),
          driverVehicle: headers.findIndex(h => h === 'DRIVER VEHICLE NUMBER'),
          porter: headers.findIndex(h => h === 'PORTER'),
          byHand: headers.findIndex(h => h === 'BY HAND'),
          byHandPerson: headers.findIndex(h => h === 'BY HAND PERSON NAME'),
        };

        const formattedData = rows
          .map((row, index) => {
            // Skip rows that don't have a bill number
            if (!row || row.length === 0 || !row[columnIndices.billNumber]) {
              return null;
            }

            // CHECK: Calculate status rather than skipping
            const gatepassValue = row[columnIndices.gatepassCreated] || '';
            const hasGatepass = gatepassValue.trim() !== '';

            let formattedDate = '';
            const rawBillDate = row[columnIndices.billDate] || '';

            if (rawBillDate) {
              if (rawBillDate.match(/^\d{4}-\d{2}-\d{2}/)) {
                formattedDate = rawBillDate;
              } else {
                const dateObj = new Date(rawBillDate);
                if (!isNaN(dateObj.getTime())) {
                  formattedDate = dateObj.toISOString().split('T')[0];
                } else {
                  formattedDate = rawBillDate;
                }
              }
            }

            const totalBoxes = parseInt(row[columnIndices.totalBoxes]) || 0;
            const totalBags = parseInt(row[columnIndices.totalBags]) || 0;
            const totalPolybags = parseInt(row[columnIndices.totalPolybags]) || 0;

            let bagDetails = [];
            if (totalBoxes > 0) bagDetails.push(`${totalBoxes} Petti`);
            if (totalBags > 0) bagDetails.push(`${totalBags} Bora`);
            if (totalPolybags > 0) bagDetails.push(`${totalPolybags} Polybags`);
            const bagDetailsText = bagDetails.join(' + ') || '0';

            return {
              id: `${row[columnIndices.billNumber] || index}_${index}`,
              date: formattedDate,
              originalBillDate: rawBillDate,
              billNumber: row[columnIndices.billNumber] || '',
              partyName: row[columnIndices.partyName] || '',
              bagDetails: bagDetailsText,
              driverName: row[columnIndices.driverName] || '',
              vehicleNumber: row[columnIndices.driverVehicle] || '',
              driverContact: row[columnIndices.driverContact] || '',
              porter: row[columnIndices.porter] || '',
              byHand: row[columnIndices.byHand] || '',
              byHandPerson: row[columnIndices.byHandPerson] || '',
              gatepassTime: row[columnIndices.gatepassTime] || '',
              gatepassCreated: gatepassValue,
              hasGatepass: hasGatepass,
              totalBoxes: totalBoxes,
              totalBags: totalBags,
              totalPolybags: totalPolybags,
              rawData: row
            };
          })
          .filter(row => row !== null); // Remove any null entries

        console.log(`Total records: ${formattedData.length}`);

        // Apply role-based filter based on accessLevel parameter
        let roleFilteredData;
        if (accessLevel === 'admin') {
          roleFilteredData = formattedData;
          console.log(`Admin filter - Showing all ${formattedData.length} records`);
        } else if (accessLevel === 'manager') {
          roleFilteredData = formattedData.filter(item => isWithinLastTwoDays(item.date));
          console.log(`Manager filter - Showing ${roleFilteredData.length} records from last 2 days`);
        } else {
          roleFilteredData = formattedData.filter(item => isToday(item.date));
          console.log(`Viewer filter - Showing ${roleFilteredData.length} records from today`);
        }

        setGatepassData(formattedData);
        setFilteredData(roleFilteredData);

        if (formattedData.length === 0) {
          console.log("No bills found");
        }
      } else {
        console.log("No data found in the spreadsheet");
        setGatepassData([]);
        setFilteredData([]);
      }
    } catch (error) {
      console.error('Error fetching gatepass data:', error);
      alert(`Failed to fetch gatepass data from Google Sheets: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    let filtered = [...gatepassData];

    // First apply role-based filter based on current roleInfo
    if (roleInfo.accessLevel === 'admin') {
      // Keep all data
      filtered = [...gatepassData];
    } else if (roleInfo.accessLevel === 'manager') {
      filtered = gatepassData.filter(item => isWithinLastTwoDays(item.date));
    } else {
      filtered = gatepassData.filter(item => isToday(item.date));
    }

    // Then apply search and date filters
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.billNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.partyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.driverName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.driverContact?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (startDate && (roleInfo.accessLevel === 'admin' || roleInfo.accessLevel === 'manager')) {
      filtered = filtered.filter(item => item.date >= startDate);
    }

    if (endDate && (roleInfo.accessLevel === 'admin' || roleInfo.accessLevel === 'manager')) {
      filtered = filtered.filter(item => item.date <= endDate);
    }

    setFilteredData(filtered);
  };

  // Initialize component - FIXED: Set role and fetch data synchronously
  useEffect(() => {
    const effectiveRole = getEffectiveRole();
    const roleLower = effectiveRole?.toLowerCase() || '';

    console.log("GatepassDetails - Effective role:", effectiveRole);
    console.log("GatepassDetails - Lowercase role:", roleLower);

    // Determine access level
    let accessLevel = 'viewer';
    let message = 'Viewing today\'s gatepass records only';

    if (roleLower === 'admin' ||
      roleLower === 'administrative' ||
      roleLower === 'superadmin' ||
      roleLower === 'administrator') {
      console.log("✅ ADMIN access granted - Showing ALL gatepass records");
      accessLevel = 'admin';
      message = 'Viewing all gatepass records (Full Access)';
    } else if (roleLower === 'manager') {
      console.log("✅ MANAGER access granted - Showing last 2 days");
      accessLevel = 'manager';
      message = 'Viewing last 2 days of gatepass records';
    } else {
      console.log("✅ VIEWER access granted - Showing today's records only");
      accessLevel = 'viewer';
      message = 'Viewing today\'s gatepass records only';
    }

    // Set role info state
    setRoleInfo({
      role: effectiveRole,
      accessLevel: accessLevel,
      message: message
    });

    // Fetch data with the determined access level
    fetchGatepassData(accessLevel);
  }, []);

  // Apply filters when search/filters change
  useEffect(() => {
    if (gatepassData.length > 0) {
      filterData();
    }
  }, [searchTerm, startDate, endDate, gatepassData, roleInfo.accessLevel]);

  const clearFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
  };

  const viewDetails = (row) => {
    setSelectedRow(row);
    setShowModal(true);
  };

  const formatDisplayDate = (dateString) => {
    if (!dateString) return '-';
    if (dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }
    return dateString;
  };

  const downloadGatepassPDF = (isSingle = false, singleItem = null) => {
    try {
      if (typeof jsPDF === 'undefined') {
        alert("PDF library not loaded. Please refresh the page.");
        return false;
      }

      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - (margin * 2);

      const safeFormatDisplayDate = (dateValue) => {
        if (!dateValue) return '';
        try {
          if (typeof dateValue === 'string') {
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
              return date.toLocaleDateString('en-GB');
            }
            return dateValue;
          }
          return '';
        } catch (error) {
          return String(dateValue);
        }
      };

      // Tally-style Header Section (Compact and Clean)
      doc.setFont("times", "bold");
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text("DISPATCH GATEPASS  Summary", margin, 15);

      doc.setFontSize(11);
      doc.text("GATE PASS REGISTER", pageWidth - margin, 15, { align: "right" });

      doc.setDrawColor(80, 80, 80);
      doc.setLineWidth(0.4);
      doc.line(margin, 18, margin + contentWidth, 18);

      // Report info fields
      doc.setFont("times", "normal");
      doc.setFontSize(8.5);
      const startText = startDate ? safeFormatDisplayDate(startDate) : "Beginning";
      const endText = endDate ? safeFormatDisplayDate(endDate) : "Latest";
      doc.text(`Period: ${startText} to ${endText}`, margin, 23);

      const userName = userData?.fullName || userData?.name || userData?.username || roleInfo.role;
      doc.text(`Prepared By: ${userName} (${getRoleDisplayName()})`, margin + 110, 23);

      const generationTime = new Date().toLocaleString('en-GB');
      doc.text(`Print Date: ${generationTime}`, pageWidth - margin, 23, { align: "right" });

      doc.line(margin, 25, margin + contentWidth, 25);

      // Widths summing exactly to 277mm for A4 landscape
      const headers = ["Date", "Bill No.", "Party Particulars / Description", "Bags details", "Driver Name", "Vehicle No."];
      const colWidths = [25, 30, 95, 47, 35, 45];

      let yPos = 28;
      const itemsToShow = isSingle ? (singleItem ? [singleItem] : []) : (filteredData || []);

      if (itemsToShow.length === 0) {
        doc.setFontSize(12);
        doc.text("No gatepass data available for this selection.", pageWidth / 2, yPos + 20, { align: "center" });
        doc.save("Gatepass_Empty_Register.pdf");
        return true;
      }

      // Render Table Header
      doc.setFont("times", "bold");
      doc.setFontSize(9);
      doc.setFillColor(240, 242, 245);
      doc.rect(margin, yPos, contentWidth, 8, 'F');
      doc.rect(margin, yPos, contentWidth, 8); // Header border outline

      let currentX = margin;
      headers.forEach((header, i) => {
        doc.text(header, currentX + 2, yPos + 5.5);
        currentX += colWidths[i];
      });

      // Header column lines
      let headLineX = margin;
      colWidths.forEach((w, i) => {
        headLineX += w;
        if (i < colWidths.length - 1) {
          doc.line(headLineX, yPos, headLineX, yPos + 8);
        }
      });

      yPos += 8;
      doc.setTextColor(0, 0, 0);

      let totalPetti = 0;
      let totalBora = 0;
      let totalPolybags = 0;

      // Render Data Rows
      itemsToShow.forEach((item, index) => {
        const rowHeight = 8;
        const formattedDate = safeFormatDisplayDate(item.date);

        const values = [
          formattedDate,
          item.billNumber || '',
          item.partyName || '',
          item.bagDetails || '',
          item.driverName || '',
          item.vehicleNumber || ''
        ];

        // Sum bags details
        if (item.bagDetails && typeof item.bagDetails === 'string') {
          const bagText = item.bagDetails;
          const pettiMatch = bagText.match(/Petti[:\s]*(\d+)|(\d+)[\s]*Petti/i);
          if (pettiMatch) {
            totalPetti += parseInt(pettiMatch[1] || pettiMatch[2]) || 0;
          }
          const boraMatch = bagText.match(/Bora[:\s]*(\d+)|(\d+)[\s]*Bora/i);
          if (boraMatch) {
            totalBora += parseInt(boraMatch[1] || boraMatch[2]) || 0;
          }
          const polybagsMatch = bagText.match(/Polybags?[:\s]*(\d+)|(\d+)[\s]*Polybags?/i);
          if (polybagsMatch) {
            totalPolybags += parseInt(polybagsMatch[1] || polybagsMatch[2]) || 0;
          }
        }

        // Check vertical overflow
        if (yPos + rowHeight > pageHeight - 30) {
          doc.addPage();
          yPos = 15;
          doc.setFont("times", "bold");
          doc.setFontSize(9);
          doc.setFillColor(240, 242, 245);
          doc.rect(margin, yPos, contentWidth, 8, 'F');
          doc.rect(margin, yPos, contentWidth, 8);
          let headX = margin;
          headers.forEach((h, i) => {
            doc.text(h, headX + 2, yPos + 5.5);
            headX += colWidths[i];
          });

          let headL = margin;
          colWidths.forEach((w, i) => {
            headL += w;
            if (i < colWidths.length - 1) {
              doc.line(headL, yPos, headL, yPos + 8);
            }
          });
          yPos += 8;
        }

        // Draw row outline box
        doc.setDrawColor(180, 180, 180);
        doc.rect(margin, yPos, contentWidth, rowHeight);

        let rowX = margin;
        values.forEach((val, i) => {
          let text = String(val || '');
          if (i === 2 && text.length > 60) {
            text = text.substring(0, 57) + '...';
          }
          doc.setFont("times", "normal");
          doc.setFontSize(8.5);
          doc.text(text, rowX + 2, yPos + 5.5);
          rowX += colWidths[i];
        });

        // Column dividers
        let colDivX = margin;
        colWidths.forEach((w, i) => {
          colDivX += w;
          if (i < colWidths.length - 1) {
            doc.line(colDivX, yPos, colDivX, yPos + rowHeight);
          }
        });

        yPos += rowHeight;
      });

      // Tally ledger grand total footer row
      const totalRowHeight = 8;
      if (yPos + totalRowHeight > pageHeight - 30) {
        doc.addPage();
        yPos = 15;
      }

      // Draw top total border
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.line(margin, yPos, margin + contentWidth, yPos);

      // Print columns in Grand Total row
      doc.setFont("times", "bold");
      doc.setFontSize(9);
      doc.text("GRAND TOTAL", margin + colWidths[0] + colWidths[1] + 2, yPos + 5.5);

      // Bags totals in bags detail column
      let parts = [];
      if (totalPetti > 0) parts.push(`${totalPetti} Petti`);
      if (totalBora > 0) parts.push(`${totalBora} Bora`);
      if (totalPolybags > 0) parts.push(`${totalPolybags} Poly`);
      const totalBagsText = parts.join(" + ") || "0 Bags";
      doc.text(totalBagsText, margin + colWidths[0] + colWidths[1] + colWidths[2] + 2, yPos + 5.5);

      // Total count in driver column
      doc.text(`Bills: ${itemsToShow.length}`, margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 2, yPos + 5.5);

      // Draw vertical lines in Total row
      let totLineX = margin;
      colWidths.forEach((w, i) => {
        totLineX += w;
        if (i < colWidths.length - 1) {
          doc.line(totLineX, yPos, totLineX, yPos + totalRowHeight);
        }
      });

      yPos += totalRowHeight;

      // Draw Tally double border underneath totals
      doc.line(margin, yPos, margin + contentWidth, yPos);
      doc.line(margin, yPos + 0.8, margin + contentWidth, yPos + 0.8);

      // Sign-off section (Checked By / Authorised Signatory)
      yPos += 18;
      if (yPos > pageHeight - 15) {
        doc.addPage();
        yPos = 30;
      }

      doc.setFont("times", "normal");
      doc.setFontSize(8.5);

      doc.text("Prepared By", margin + 10, yPos);
      doc.line(margin + 5, yPos - 5, margin + 45, yPos - 5);

      doc.text("Checked By", margin + 110, yPos);
      doc.line(margin + 100, yPos - 5, margin + 140, yPos - 5);

      doc.text("Authorised Signatory", pageWidth - margin - 45, yPos);
      doc.line(pageWidth - margin - 50, yPos - 5, pageWidth - margin - 5, yPos - 5);

      // Standard footer
      const footerY = pageHeight - 8;
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - margin, footerY, { align: "right" });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const fileName = `Gatepass_Register_${timestamp}.pdf`;

      doc.save(fileName);
      return true;

    } catch (error) {
      console.error("PDF Error:", error);
      alert(`Failed to generate PDF: ${error.message}`);
      return false;
    }
  };

  const downloadAllDataPDF = () => {
    if (filteredData.length === 0) {
      alert('No data to download');
      return;
    }
    downloadGatepassPDF(false, null);
  };

  const generateSinglePDF = (item) => {
    downloadGatepassPDF(true, item);
  };

  const getRoleBadgeColor = () => {
    switch (roleInfo.accessLevel) {
      case 'admin': return '#1e3a5f';
      case 'manager': return '#2c5f8a';
      default: return '#3a7ca5';
    }
  };

  const getRoleDisplayName = () => {
    switch (roleInfo.accessLevel) {
      case 'admin': return 'Administrator';
      case 'manager': return 'Manager';
      default: return 'Viewer';
    }
  };

  return (
    <div className="gatepass-container" style={{
      minHeight: '100vh',
      background: '#f1f5f9',
      padding: '24px 16px'
    }}>
      <div className="gatepass-paper" style={{
        maxWidth: '2400px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '20px',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)',
        overflow: 'hidden',
        border: '1px solid rgba(15, 23, 42, 0.08)'
      }}>
        {/* Header with Royal Navy theme */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          padding: '24px 32px',
          borderBottom: '4px solid #ffd700'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <button
              onClick={handleBackNavigation}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                padding: '10px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
            >
              <span style={{ fontSize: '18px' }}>←</span>
              <span>Back</span>
            </button>

            <div style={{ textAlign: 'center' }}>
              <h1 style={{
                color: 'white',
                fontSize: '28px',
                margin: '0 0 8px 0',
                fontWeight: '600',
                letterSpacing: '-0.5px'
              }}>
                Gatepass Management
              </h1>
              <p style={{
                color: 'rgba(255, 255, 255, 0.8)',
                margin: 0,
                fontSize: '14px'
              }}>
                Manage and track all gatepass entries
              </p>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.15)',
              padding: '8px 20px',
              borderRadius: '12px',
              textAlign: 'center',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffd700' }}>
                {filteredData.length}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)' }}>Total Bills</div>
            </div>
          </div>
        </div>

        {/* Role Banner */}
        <div style={{
          background: `linear-gradient(135deg, ${getRoleBadgeColor()} 0%, ${getRoleBadgeColor()}dd 100%)`,
          color: 'white',
          padding: '12px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '13px',
          borderBottom: '1px solid rgba(0, 32, 64, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span style={{
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              👤 {getRoleDisplayName()}
            </span>
            <span>📋 {roleInfo.message}</span>
          </div>
          {(() => {
            const displayName = userData?.name || userData?.username ||
              (() => {
                try {
                  const stored = localStorage.getItem('userData');
                  if (stored) {
                    const parsed = JSON.parse(stored);
                    return parsed.name || parsed.username;
                  }
                } catch (e) { }
                return null;
              })();
            return displayName && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.15)',
                padding: '4px 12px',
                borderRadius: '20px'
              }}>
                <span>👋</span>
                <span>Welcome, {displayName}</span>
              </div>
            );
          })()}
        </div>

        {/* Filters Section */}
        <div style={{
          padding: '24px 32px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <div style={{
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <input
                type="text"
                placeholder="🔍 Search by Bill No, Party, Driver..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#1e3a5f'}
                onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
              />
            </div>

            {(roleInfo.accessLevel === 'admin' || roleInfo.accessLevel === 'manager') && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                <span style={{ color: '#64748b' }}>—</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
            )}

            {(searchTerm || startDate || endDate) && (
              <button
                onClick={clearFilters}
                style={{
                  padding: '10px 20px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
              >
                Clear Filters
              </button>
            )}

            <button
              onClick={() => {
                const effectiveRole = getEffectiveRole();
                const roleLower = effectiveRole?.toLowerCase() || '';
                let accessLevel = 'viewer';
                if (roleLower === 'admin' || roleLower === 'administrative' || roleLower === 'superadmin' || roleLower === 'administrator') {
                  accessLevel = 'admin';
                } else if (roleLower === 'manager') {
                  accessLevel = 'manager';
                }
                fetchGatepassData(accessLevel);
              }}
              style={{
                padding: '10px 20px',
                background: '#1e3a5f',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#2c5f8a'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#1e3a5f'}
            >
              <span>↻</span> Refresh
            </button>

            <button
              onClick={downloadAllDataPDF}
              style={{
                padding: '10px 24px',
                background: '#ffd700',
                color: '#1e3a5f',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#ffed4a'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#ffd700'}
            >
              <span>📥</span> Download PDF
            </button>
          </div>
        </div>

        {/* Table Section */}
        <div style={{ padding: '32px', overflowX: 'auto' }}>
          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: '#f8fafc',
              borderRadius: '12px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                border: '3px solid #e2e8f0',
                borderTopColor: '#1e3a5f',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }}></div>
              <p style={{ color: '#64748b' }}>Loading gatepass data...</p>
            </div>
          ) : (
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              background: 'white',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)'
            }}>
              <thead>
                <tr style={{ background: '#0f172a' }}>
                  <th style={{ padding: '16px 12px', textAlign: 'left', color: 'white', fontWeight: '700', fontSize: '13px', borderBottom: '3px solid #f59e0b' }}>Date</th>
                  <th style={{ padding: '16px 12px', textAlign: 'left', color: 'white', fontWeight: '700', fontSize: '13px', borderBottom: '3px solid #f59e0b' }}>Bill No.</th>
                  <th style={{ padding: '16px 12px', textAlign: 'left', color: 'white', fontWeight: '700', fontSize: '13px', borderBottom: '3px solid #f59e0b' }}>Party Name</th>
                  <th style={{ padding: '16px 12px', textAlign: 'left', color: 'white', fontWeight: '700', fontSize: '13px', borderBottom: '3px solid #f59e0b' }}>Packing Details</th>
                  <th style={{ padding: '16px 12px', textAlign: 'left', color: 'white', fontWeight: '700', fontSize: '13px', borderBottom: '3px solid #f59e0b' }}>Driver</th>
                  <th style={{ padding: '16px 12px', textAlign: 'left', color: 'white', fontWeight: '700', fontSize: '13px', borderBottom: '3px solid #f59e0b' }}>Vehicle No.</th>
                  <th style={{ padding: '16px 12px', textAlign: 'left', color: 'white', fontWeight: '700', fontSize: '13px', borderBottom: '3px solid #f59e0b' }}>Contact</th>
                  <th style={{ padding: '16px 12px', textAlign: 'left', color: 'white', fontWeight: '700', fontSize: '13px', borderBottom: '3px solid #f59e0b' }}>Status</th>
                  <th style={{ padding: '16px 12px', textAlign: 'center', color: 'white', fontWeight: '700', fontSize: '13px', borderBottom: '3px solid #f59e0b' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{
                      textAlign: 'center',
                      padding: '60px 20px',
                      background: '#f8fafc'
                    }}>
                      <div>
                        <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
                        <p style={{ color: '#0f172a', margin: '0 0 8px 0', fontWeight: '700' }}>No records found</p>
                        <small style={{ color: '#475569', fontWeight: '500' }}>
                          {roleInfo.accessLevel === 'admin' && 'Try adjusting your search filters'}
                          {roleInfo.accessLevel === 'manager' && 'No records found in the last 2 days'}
                          {roleInfo.accessLevel === 'viewer' && 'No records found for today'}
                        </small>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, index) => (
                    <tr key={item.id} style={{
                      borderBottom: '1px solid #e2e8f0',
                      background: index % 2 === 0 ? 'white' : '#f8fafc',
                      transition: 'background 0.2s'
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? 'white' : '#f8fafc'}>
                      <td style={{ padding: '14px 12px', fontSize: '13px', color: '#0f172a', fontWeight: '600' }}>{formatDisplayDate(item.date)}</td>
                      <td style={{ padding: '14px 12px', fontSize: '13px', fontWeight: '700', color: '#1e3a5f', fontFamily: 'monospace' }}>{item.billNumber}</td>
                      <td style={{ padding: '14px 12px', fontSize: '13px', color: '#0f172a', fontWeight: '600' }}>{item.partyName}</td>
                      <td style={{ padding: '14px 12px', fontSize: '13px', color: '#0f172a' }}>
                        <span style={{
                          background: '#e0f2fe',
                          color: '#0369a1',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          display: 'inline-block'
                        }}>
                          {item.bagDetails}
                        </span>
                      </td>
                      <td style={{ padding: '14px 12px', fontSize: '13px', color: '#0f172a', fontWeight: '600' }}>{item.driverName || '-'}</td>
                      <td style={{ padding: '14px 12px', fontSize: '13px', fontFamily: 'monospace', color: '#0f172a', fontWeight: '600' }}>{item.vehicleNumber || '-'}</td>
                      <td style={{ padding: '14px 12px', fontSize: '13px', color: '#0f172a', fontWeight: '600' }}>{item.driverContact || '-'}</td>
                      <td style={{ padding: '14px 12px', fontSize: '13px' }}>
                        <span style={{
                          background: item.hasGatepass ? '#d1fae5' : '#fee2e2',
                          color: item.hasGatepass ? '#065f46' : '#991b1b',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '800',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {item.hasGatepass ? '✓ Created' : '⚠ Pending'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            onClick={() => viewDetails(item)}
                            style={{
                              padding: '6px 12px',
                              background: '#0f172a',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#1e293b'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#0f172a'}
                          >
                            👁️ View
                          </button>
                          <button
                            onClick={() => generateSinglePDF(item)}
                            style={{
                              padding: '6px 12px',
                              background: '#f59e0b',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '700',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#d97706'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#f59e0b'}
                          >
                            📄 PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && selectedRow && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }} onClick={() => setShowModal(false)}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.15)',
            border: '1px solid rgba(15, 23, 42, 0.08)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              padding: '20px 24px',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '3px solid #f59e0b'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', fontFamily: 'Outfit, sans-serif' }}>Bill Details</h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: 'white',
                  fontSize: '20px',
                  cursor: 'pointer',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold'
                }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#475569', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Bill Number</label>
                <span style={{ fontSize: '16px', fontWeight: '800', color: '#1e3a5f', fontFamily: 'monospace' }}>{selectedRow.billNumber}</span>
              </div>
              <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#475569', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Bill Date</label>
                <span style={{ fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>{formatDisplayDate(selectedRow.date)}</span>
              </div>
              <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#475569', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Party Name</label>
                <span style={{ fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>{selectedRow.partyName}</span>
              </div>
              <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#475569', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Packing Details</label>
                <span style={{ fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>{selectedRow.bagDetails}</span>
              </div>
              <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#475569', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Driver Name</label>
                <span style={{ fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>{selectedRow.driverName || 'Not assigned'}</span>
              </div>
              <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#475569', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Vehicle Number</label>
                <span style={{ fontSize: '14px', color: '#0f172a', fontWeight: '700', fontFamily: 'monospace' }}>{selectedRow.vehicleNumber || 'Not assigned'}</span>
              </div>
              <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#475569', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Driver Contact</label>
                <span style={{ fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>{selectedRow.driverContact || 'Not assigned'}</span>
              </div>
              <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#475569', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Porter Required</label>
                <span style={{ fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>{selectedRow.porter === 'YES' ? 'Yes' : 'No'}</span>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#475569', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>By Hand Quantity</label>
                <span style={{ fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>{selectedRow.byHand || '0'}</span>
              </div>
            </div>
            <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '8px 20px',
                  background: '#1e3a5f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default GatepassDetails;