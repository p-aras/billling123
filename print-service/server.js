// print-service/server.js

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Try to load thermal printer package
let ThermalPrinter, PrinterTypes;
try {
  const thermalPrinterModule = require('node-thermal-printer');
  ThermalPrinter = thermalPrinterModule.ThermalPrinter;
  PrinterTypes = thermalPrinterModule.PrinterTypes;
  console.log('✅ Thermal printer package loaded successfully');
} catch (err) {
  console.log('⚠️ Thermal printer package not available, using fallback mode');
  ThermalPrinter = null;
  PrinterTypes = null;
}

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Function to print using node-thermal-printer (direct ESC/POS commands) with SMALL barcode
async function printWithThermalPrinter(sticker, config) {
  return new Promise((resolve, reject) => {
    try {
      if (!ThermalPrinter) {
        throw new Error('Thermal printer package not installed');
      }
      
      // Initialize printer for TVS LP-46 (uses Epson ESC/POS commands)
      const thermalPrinter = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: config.printerName || 'SNBC TVSE LP46 Dlite BPLE',
        options: {
          timeout: 10000
        },
        width: 48, // 48mm width for thermal labels
        characterSet: 'UTF-8',
        removeSpecialCharacters: false
      });
      
      // Connect and print
      thermalPrinter.connect().then(() => {
        console.log('  ✅ Connected to printer');
        
        // Start building the simplified sticker with SMALL barcode
        thermalPrinter.alignCenter();
        
        // Small top margin
        thermalPrinter.println(' ');
        thermalPrinter.println(' ');
        
        // SMALL barcode (centered, smaller size)
        if (sticker.barcodeId) {
          thermalPrinter.barcode(sticker.barcodeId, 'CODE128', {
            width: 1,        // Small width for smaller barcode
            height: 40,      // Smaller height
            text: 1          // Show text below barcode
          });
          thermalPrinter.println(' ');
          thermalPrinter.println(' ');
        }
        
        // Pcs/Set and Ratio information
        thermalPrinter.setTextNormal();
        thermalPrinter.println(`PCS/SET: ${sticker.piecesPerSet}     RATIO: ${sticker.setRatio}`);
        
        // Small bottom margin
        thermalPrinter.println(' ');
        thermalPrinter.println(' ');
        
        // Cut the paper
        thermalPrinter.cut();
        
        // Execute print
        thermalPrinter.execute()
          .then(() => {
            console.log('  ✅ Print command executed successfully');
            resolve({ success: true, method: 'ThermalPrinter' });
          })
          .catch((err) => {
            console.error('  ❌ Print execution failed:', err);
            reject(err);
          });
          
      }).catch((err) => {
        console.error('  ❌ Connection failed:', err);
        reject(err);
      });
    } catch (error) {
      console.error('  ❌ Printer initialization failed:', error);
      reject(error);
    }
  });
}

// Function to print using direct ESC/POS commands via serial port (alternative)
async function printDirectESCPOS(sticker, config) {
  return new Promise((resolve, reject) => {
    try {
      // Create ESC/POS commands manually
      const ESC = '\x1B';
      const GS = '\x1D';
      const LF = '\x0A';
      
      let commands = '';
      
      // Initialize printer
      commands += ESC + '@';
      
      // Center alignment
      commands += ESC + 'a' + '\x01';
      
      // Line spacing
      commands += ESC + '3' + '\x10';
      
      // Top margin
      commands += LF + LF;
      
      // Barcode (CODE128) - SMALL SIZE
      if (sticker.barcodeId) {
        commands += GS + 'k' + '\x49';
        commands += String.fromCharCode(sticker.barcodeId.length);
        commands += sticker.barcodeId;
        commands += LF;
      }
      
      commands += LF + LF;
      
      // Pcs/Set and Ratio
      commands += `PCS/SET: ${sticker.piecesPerSet}     RATIO: ${sticker.setRatio}`;
      commands += LF + LF;
      
      // Cut paper
      commands += GS + 'V' + '\x01';
      
      // Convert to buffer and send to printer
      const tempFile = path.join(os.tmpdir(), `escp_${Date.now()}.bin`);
      fs.writeFileSync(tempFile, commands, 'binary');
      
      // Send to printer
      const printCommand = `print /D:"${config.printerName}" "${tempFile}"`;
      exec(printCommand, { timeout: 30000 }, (error) => {
        setTimeout(() => {
          try {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
          } catch (e) {}
        }, 3000);
        
        if (error) {
          reject(error);
        } else {
          resolve({ success: true, method: 'DirectESCPOS' });
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Fallback: Print using silent Notepad (no window popup) with simplified format
async function printSilentNotepad(textContent) {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(os.tmpdir(), `sticker_${Date.now()}.txt`);
    
    fs.writeFile(tempFile, textContent, 'utf8', (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Use PowerShell to print silently
      const psCommand = `
        $file = "${tempFile}"
        $printer = Get-Printer | Where-Object {$_.Name -like "*SNBC*" -or $_.Name -like "*LP46*"} | Select-Object -First 1
        if ($printer) {
          Get-Content $file | Out-Printer -Name $printer.Name
        } else {
          Get-Content $file | Out-Printer
        }
      `;
      
      exec(`powershell -Command "${psCommand.replace(/"/g, '\\"')}"`, { timeout: 30000 }, (error) => {
        setTimeout(() => {
          try {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
          } catch (e) {}
        }, 3000);
        
        if (error) {
          reject(error);
        } else {
          resolve({ success: true, method: 'SilentNotepad' });
        }
      });
    });
  });
}

// Generate simplified text format with ASCII barcode for fallback printing
function generateSimplifiedText(sticker, config) {
  // Create ASCII barcode representation
  const barcodeText = sticker.barcodeId || 'N/A';
  const barcodeWidth = barcodeText.length + 4;
  const barcodeLine = '*' + '*'.repeat(barcodeWidth) + '*';
  
  return `
${barcodeLine}
*   ${barcodeText}   *
${barcodeLine}

PCS/SET: ${sticker.piecesPerSet}     RATIO: ${sticker.setRatio}
`;
}

// Main print function
async function printSticker(sticker, config) {
  console.log(`  📝 Printing sticker for lot: ${sticker.lotNumber}`);
  
  // Try direct ESC/POS first (most reliable for thermal printers)
  try {
    console.log('  🖨️ Trying direct ESC/POS printing...');
    const result = await printDirectESCPOS(sticker, config);
    console.log(`  ✅ Success with direct ESC/POS`);
    return result;
  } catch (escpError) {
    console.log(`  ⚠️ Direct ESC/POS failed: ${escpError.message}`);
    
    // Try thermal printer package if available
    if (ThermalPrinter) {
      try {
        console.log('  🖨️ Trying thermal printer package...');
        const result = await printWithThermalPrinter(sticker, config);
        console.log(`  ✅ Success with thermal printer package`);
        return result;
      } catch (thermalError) {
        console.log(`  ⚠️ Thermal package failed: ${thermalError.message}`);
      }
    }
    
    // Fallback to text printing
    console.log('  📄 Falling back to text printing...');
    const textContent = generateSimplifiedText(sticker, config);
    const result = await printSilentNotepad(textContent);
    console.log(`  ✅ Success with silent text print`);
    return result;
  }
}

// ============================
// API ENDPOINTS
// ============================

app.get('/health', (req, res) => {
  res.json({ 
    running: true, 
    version: '2.0.0', 
    timestamp: new Date().toISOString(),
    printer: 'TVS LP-46 Dlite',
    features: ['barcode', 'direct-escp', 'silent-printing', 'small-barcode']
  });
});

app.get('/printers', (req, res) => {
  exec('wmic printer get name', (error, stdout) => {
    if (error) {
      console.error('Error getting printers:', error);
      res.json({ 
        printers: [{ 
          name: 'SNBC TVSE LP46 Dlite BPLE', 
          default: true,
          status: 'unknown'
        }] 
      });
    } else {
      const printers = stdout.split('\n')
        .slice(1)
        .map(p => p.trim())
        .filter(p => p && !p.includes('Name') && p !== '')
        .map(p => ({ 
          name: p, 
          default: p.toLowerCase().includes('snbc') || p.toLowerCase().includes('lp46')
        }));
      
      res.json({ printers: printers.length ? printers : [{ name: 'SNBC TVSE LP46 Dlite BPLE', default: true }] });
    }
  });
});

// Print endpoint
app.post('/print', async (req, res) => {
  const { stickers, config } = req.body;
  
  console.log('📨 Print request received:', {
    stickerCount: stickers?.length,
    printer: config?.printerName || 'default',
    copies: config?.copies || 1
  });
  
  if (!stickers || !stickers.length) {
    return res.status(400).json({ success: false, error: 'No stickers to print' });
  }
  
  try {
    let printed = 0;
    let failed = 0;
    const total = stickers.length * (config.copies || 1);
    
    for (let i = 0; i < stickers.length; i++) {
      const sticker = stickers[i];
      const copies = config.copies || 1;
      
      for (let c = 0; c < copies; c++) {
        console.log(`🖨️ Printing sticker ${i + 1}/${stickers.length}, copy ${c + 1}/${copies}`);
        
        try {
          await printSticker(sticker, config);
          printed++;
          
          // Small delay between prints
          if (printed % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          failed++;
          console.error(`  ❌ Failed: ${error.message}`);
        }
      }
    }
    
    console.log(`✅ Print completed: ${printed}/${total} stickers printed, ${failed} failed`);
    
    res.json({ 
      success: failed === 0,
      printed: printed,
      failed: failed,
      total: total,
      message: `Printed ${printed} stickers${failed > 0 ? `, ${failed} failed` : ''}`
    });
    
  } catch (error) {
    console.error('❌ Print error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test print endpoint
app.post('/test-print', async (req, res) => {
  const { printerName } = req.body;
  
  const testSticker = {
    lotNumber: 'TEST-001',
    partyName: 'QUALITY APPARELS TEST',
    style: 'TEST STYLE',
    sets: 10,
    piecesPerSet: 5,
    setRatio: '1:1:1',
    barcodeId: `TEST${Date.now().toString().slice(-8)}`,
    barcodeImage: ''
  };
  
  const config = {
    printerName: printerName || 'SNBC TVSE LP46 Dlite BPLE',
    labelWidth: 61,
    labelHeight: 40.6,
    copies: 1
  };
  
  try {
    console.log('🧪 Running test print with SMALL barcode...');
    const result = await printSticker(testSticker, config);
    console.log('✅ Test print completed:', result);
    res.json({ 
      success: true, 
      message: 'Test print sent successfully with small barcode', 
      method: result.method,
      barcode: testSticker.barcodeId,
      content: {
        barcode: testSticker.barcodeId,
        piecesPerSet: testSticker.piecesPerSet,
        ratio: testSticker.setRatio
      },
      note: 'Small barcode printed!'
    });
  } catch (error) {
    console.error('❌ Test print failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      suggestion: 'Please check printer connection and try again'
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🎨 TVS LP-46 Dlite Print Service running on http://localhost:${PORT}`);
  console.log(`📋 Small barcode design: Centered small barcode + PCS/SET + RATIO`);
  console.log(`🖨️  Target printer: SNBC TVSE LP46 Dlite BPLE`);
  console.log(`🔖 Features: Small barcode (width=1, height=40), silent printing`);
  console.log(`\n💡 Test with:`);
  console.log(`   curl -X POST http://localhost:${PORT}/test-print -H "Content-Type: application/json" -d "{\\"printerName\\":\\"SNBC TVSE LP46 Dlite BPLE\\"}"`);
});