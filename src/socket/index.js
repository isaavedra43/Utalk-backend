/**
 * 🔄 SOCKET MANAGER MIGRATION
 * 
 * This file now redirects to the new EnterpriseSocketManager
 * which implements enterprise-grade real-time functionality
 * based on Socket.IO best practices.
 * 
 * @deprecated Use EnterpriseSocketManager directly
 */

const EnterpriseSocketManager = require('./enterpriseSocketManager');

// Export the enterprise socket manager for backward compatibility
module.exports = EnterpriseSocketManager;
