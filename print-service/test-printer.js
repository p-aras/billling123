// print-service/test-printer.js
const { exec } = require('child_process');
const fs = require('fs');

console.log('\n=================================');
console.log('🔍 Testing SNBC Printer Connection');
console.log('=================================\n');

// Configuration
const PRINTER_NAME = 'SNBC TVSE LP46 Dlite BPLE';

// Function to run PowerShell command
function runCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

// Main test function
async function testPrinter() {
    try {
        // 1. List all printers
        console.log('📋 1. Listing all printers in Windows:');
        console.log('----------------------------------------');
        const printers = await runCommand('powershell "Get-Printer | Select-Object Name, PortName, DriverName, PrinterStatus | Format-Table -AutoSize"');
        console.log(printers);
        
        // 2. Check for specific printer
        console.log('\n🔍 2. Checking for specific printer:');
        console.log('----------------------------------------');
        const printerCheck = await runCommand(`powershell "Get-Printer -Name '${PRINTER_NAME}' -ErrorAction SilentlyContinue | Select-Object Name, PortName, PrinterStatus, JobCount"`);
        
        if (!printerCheck || printerCheck.trim() === '') {
            console.log(`❌ Printer "${PRINTER_NAME}" NOT found!`);
            console.log('\n💡 Please check the printer name and ensure it matches exactly.');
            console.log('💡 The printer name should appear in the list above.');
            return;
        }
        
        console.log(`✅ Printer "${PRINTER_NAME}" found!`);
        console.log(printerCheck);
        
        // 3. Get detailed printer status
        console.log('\n📊 3. Detailed printer status:');
        console.log('----------------------------------------');
        const detailedStatus = await runCommand(`powershell "Get-Printer -Name '${PRINTER_NAME}' | Select-Object *"`);
        
        // Parse status
        const isOffline = detailedStatus.toLowerCase().includes('offline');
        const hasError = detailedStatus.toLowerCase().includes('error');
        const hasPaperJam = detailedStatus.toLowerCase().includes('jam');
        const isPaused = detailedStatus.toLowerCase().includes('paused');
        
        if (isOffline) {
            console.log('⚠️ Printer is OFFLINE');
            console.log('   Please check:');
            console.log('   • USB cable connection');
            console.log('   • Printer power');
            console.log('   • Printer is turned ON');
        } else if (hasError) {
            console.log('⚠️ Printer has errors');
            console.log('   Please check printer display for error messages');
        } else if (hasPaperJam) {
            console.log('⚠️ Paper jam detected!');
            console.log('   Please clear paper jam and try again');
        } else if (isPaused) {
            console.log('⚠️ Printer is paused');
            console.log('   Resume printing from Windows Printer Settings');
        } else {
            console.log('✅ Printer appears to be READY');
        }
        
        // 4. Test print a simple text
        console.log('\n🖨️ 4. Testing print with simple text:');
        console.log('----------------------------------------');
        
        const testFile = 'test_print.txt';
        const testContent = [
            '=================================',
            'TEST PRINT FROM SNBC PRINTER',
            '=================================',
            `Printer: ${PRINTER_NAME}`,
            `Date: ${new Date().toLocaleString()}`,
            '---------------------------------',
            'Lot Number: TEST-001',
            'Pieces: 50 PCS',
            '=================================',
            '',
            'If you can see this,',
            'your printer is working correctly!',
            '================================='
        ].join('\n');
        
        fs.writeFileSync(testFile, testContent);
        console.log(`✅ Test file created: ${testFile}`);
        
        const printCommand = `print /D:"${PRINTER_NAME}" "${testFile}"`;
        console.log(`📤 Sending print command: ${printCommand}`);
        
        exec(printCommand, (error, stdout, stderr) => {
            setTimeout(() => {
                try {
                    if (fs.existsSync(testFile)) {
                        fs.unlinkSync(testFile);
                        console.log('🧹 Test file cleaned up');
                    }
                } catch (err) {
                    console.log('Warning: Could not delete test file');
                }
            }, 2000);
            
            if (error) {
                console.error('❌ Test print FAILED:', error.message);
                console.log('\n💡 Troubleshooting tips:');
                console.log('   1. Check if printer is turned ON');
                console.log('   2. Check USB connection');
                console.log('   3. Check if printer has paper');
                console.log('   4. Restart print spooler service');
                console.log('   5. Run Windows Printer Troubleshooter');
            } else {
                console.log('✅ Test print command SENT successfully!');
                console.log('   Check your printer for the test page.');
            }
        });
        
    } catch (error) {
        console.error('❌ Error during printer test:', error.message);
    }
    
    console.log('\n=================================');
    console.log('🏁 Printer test completed');
    console.log('=================================\n');
}

// Run the test
testPrinter();