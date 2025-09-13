const cron = require('node-cron');
const PayrollService = require('../services/PayrollService');
const logger = require('../utils/logger');

/**
 * Job de Nómina - Automatización de generación de nóminas
 * Maneja la generación automática de nóminas según frecuencia configurada
 */
class PayrollJob {
  constructor() {
    this.jobs = [];
    this.isRunning = false;
  }

  /**
   * Iniciar todos los jobs de nómina
   */
  start() {
    if (this.isRunning) {
      logger.warn('⚠️ Jobs de nómina ya están ejecutándose');
      return;
    }

    logger.info('🚀 Iniciando jobs automáticos de nómina');

    try {
      // Job para nóminas diarias - se ejecuta todos los días a las 23:59
      const dailyJob = cron.schedule('59 23 * * *', async () => {
        await this.executeDailyPayrolls();
      }, {
        scheduled: false,
        name: 'daily-payroll'
      });

      // Job para nóminas semanales - se ejecuta los sábados a las 11:00 AM
      const weeklyJob = cron.schedule('0 11 * * 6', async () => {
        await this.executeWeeklyPayrolls();
      }, {
        scheduled: false,
        name: 'weekly-payroll'
      });

      // Job para nóminas quincenales - se ejecuta los días 15 y último día del mes a las 23:59
      const biweeklyJob = cron.schedule('59 23 15,28-31 * *', async () => {
        await this.executeBiweeklyPayrolls();
      }, {
        scheduled: false,
        name: 'biweekly-payroll'
      });

      // Job para nóminas mensuales - se ejecuta el último día del mes a las 23:59
      const monthlyJob = cron.schedule('59 23 28-31 * *', async () => {
        await this.executeMonthlyPayrolls();
      }, {
        scheduled: false,
        name: 'monthly-payroll'
      });

      // Job de limpieza - se ejecuta todos los días a las 02:00
      const cleanupJob = cron.schedule('0 2 * * *', async () => {
        await this.executeCleanup();
      }, {
        scheduled: false,
        name: 'payroll-cleanup'
      });

      // Guardar referencias a los jobs
      this.jobs = [
        { name: 'daily-payroll', job: dailyJob, frequency: 'daily' },
        { name: 'weekly-payroll', job: weeklyJob, frequency: 'weekly' },
        { name: 'biweekly-payroll', job: biweeklyJob, frequency: 'biweekly' },
        { name: 'monthly-payroll', job: monthlyJob, frequency: 'monthly' },
        { name: 'payroll-cleanup', job: cleanupJob, frequency: 'cleanup' }
      ];

      // Iniciar todos los jobs
      this.jobs.forEach(({ name, job }) => {
        job.start();
        logger.info(`✅ Job iniciado: ${name}`);
      });

      this.isRunning = true;
      logger.info('✅ Todos los jobs de nómina iniciados exitosamente');

    } catch (error) {
      logger.error('❌ Error iniciando jobs de nómina', error);
      throw error;
    }
  }

  /**
   * Detener todos los jobs
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('⚠️ Jobs de nómina no están ejecutándose');
      return;
    }

    logger.info('🛑 Deteniendo jobs de nómina');

    try {
      this.jobs.forEach(({ name, job }) => {
        job.stop();
        logger.info(`✅ Job detenido: ${name}`);
      });

      this.isRunning = false;
      logger.info('✅ Todos los jobs de nómina detenidos');

    } catch (error) {
      logger.error('❌ Error deteniendo jobs de nómina', error);
      throw error;
    }
  }

  /**
   * Reiniciar todos los jobs
   */
  restart() {
    logger.info('🔄 Reiniciando jobs de nómina');
    this.stop();
    setTimeout(() => {
      this.start();
    }, 1000);
  }

  /**
   * Obtener estado de los jobs
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      jobs: this.jobs.map(({ name, job, frequency }) => ({
        name,
        frequency,
        isRunning: job.running || false,
        nextExecution: this.getNextExecution(frequency)
      }))
    };
  }

  /**
   * Ejecutar nóminas diarias
   */
  async executeDailyPayrolls() {
    const startTime = new Date();
    logger.info('📅 Iniciando generación automática de nóminas diarias');

    try {
      const results = await PayrollService.generateDailyPayrolls();
      
      const summary = {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        duration: new Date() - startTime
      };

      logger.info('✅ Nóminas diarias generadas', summary);

      // Log de errores si los hay
      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        logger.warn('⚠️ Algunas nóminas diarias fallaron', {
          failures: failures.map(f => ({ employeeId: f.employeeId, error: f.error }))
        });
      }

      return summary;

    } catch (error) {
      logger.error('❌ Error ejecutando nóminas diarias', error);
      throw error;
    }
  }

  /**
   * Ejecutar nóminas semanales
   */
  async executeWeeklyPayrolls() {
    const startTime = new Date();
    logger.info('📅 Iniciando generación automática de nóminas semanales');

    try {
      const results = await PayrollService.generateWeeklyPayrolls();
      
      const summary = {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        duration: new Date() - startTime
      };

      logger.info('✅ Nóminas semanales generadas', summary);

      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        logger.warn('⚠️ Algunas nóminas semanales fallaron', {
          failures: failures.map(f => ({ employeeId: f.employeeId, error: f.error }))
        });
      }

      return summary;

    } catch (error) {
      logger.error('❌ Error ejecutando nóminas semanales', error);
      throw error;
    }
  }

  /**
   * Ejecutar nóminas quincenales
   */
  async executeBiweeklyPayrolls() {
    const startTime = new Date();
    logger.info('📅 Iniciando generación automática de nóminas quincenales');

    try {
      // Verificar si es día 15 o último día del mes
      const today = new Date();
      const dayOfMonth = today.getDate();
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      
      if (dayOfMonth !== 15 && dayOfMonth !== lastDayOfMonth) {
        logger.info('ℹ️ No es día de nómina quincenal, saltando ejecución');
        return { total: 0, successful: 0, failed: 0, skipped: true };
      }

      const results = await PayrollService.generateBiweeklyPayrolls();
      
      const summary = {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        duration: new Date() - startTime,
        period: dayOfMonth === 15 ? 'primera-quincena' : 'segunda-quincena'
      };

      logger.info('✅ Nóminas quincenales generadas', summary);

      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        logger.warn('⚠️ Algunas nóminas quincenales fallaron', {
          failures: failures.map(f => ({ employeeId: f.employeeId, error: f.error }))
        });
      }

      return summary;

    } catch (error) {
      logger.error('❌ Error ejecutando nóminas quincenales', error);
      throw error;
    }
  }

  /**
   * Ejecutar nóminas mensuales
   */
  async executeMonthlyPayrolls() {
    const startTime = new Date();
    logger.info('📅 Iniciando generación automática de nóminas mensuales');

    try {
      // Verificar si es el último día del mes
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      if (tomorrow.getMonth() === today.getMonth()) {
        logger.info('ℹ️ No es último día del mes, saltando ejecución mensual');
        return { total: 0, successful: 0, failed: 0, skipped: true };
      }

      const results = await PayrollService.generateMonthlyPayrolls();
      
      const summary = {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        duration: new Date() - startTime,
        month: today.getMonth() + 1,
        year: today.getFullYear()
      };

      logger.info('✅ Nóminas mensuales generadas', summary);

      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        logger.warn('⚠️ Algunas nóminas mensuales fallaron', {
          failures: failures.map(f => ({ employeeId: f.employeeId, error: f.error }))
        });
      }

      return summary;

    } catch (error) {
      logger.error('❌ Error ejecutando nóminas mensuales', error);
      throw error;
    }
  }

  /**
   * Ejecutar limpieza de datos
   */
  async executeCleanup() {
    const startTime = new Date();
    logger.info('🧹 Iniciando limpieza de datos de nómina');

    try {
      // Aquí se pueden implementar tareas de limpieza como:
      // - Eliminar períodos muy antiguos en estado "calculado"
      // - Limpiar logs antiguos
      // - Optimizar índices de base de datos
      // Por ahora es un placeholder

      const summary = {
        duration: new Date() - startTime,
        tasksCompleted: 0,
        message: 'Limpieza básica completada (placeholder)'
      };

      logger.info('✅ Limpieza de nómina completada', summary);
      return summary;

    } catch (error) {
      logger.error('❌ Error en limpieza de nómina', error);
      throw error;
    }
  }

  /**
   * Obtener próxima ejecución estimada
   */
  getNextExecution(frequency) {
    const now = new Date();
    
    switch (frequency) {
      case 'daily':
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        tomorrow.setHours(23, 59, 0, 0);
        return tomorrow.toISOString();
        
      case 'weekly':
        const nextSunday = new Date(now);
        const daysUntilSunday = 7 - now.getDay();
        nextSunday.setDate(now.getDate() + (daysUntilSunday === 7 ? 7 : daysUntilSunday));
        nextSunday.setHours(23, 59, 0, 0);
        return nextSunday.toISOString();
        
      case 'biweekly':
        const day = now.getDate();
        let nextBiweekly;
        if (day < 15) {
          nextBiweekly = new Date(now.getFullYear(), now.getMonth(), 15);
        } else {
          nextBiweekly = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
        nextBiweekly.setHours(23, 59, 0, 0);
        return nextBiweekly.toISOString();
        
      case 'monthly':
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        nextMonth.setHours(23, 59, 0, 0);
        return nextMonth.toISOString();
        
      case 'cleanup':
        const nextCleanup = new Date(now);
        nextCleanup.setDate(now.getDate() + 1);
        nextCleanup.setHours(2, 0, 0, 0);
        return nextCleanup.toISOString();
        
      default:
        return null;
    }
  }

  /**
   * Ejecutar job específico manualmente
   */
  async executeJobManually(frequency) {
    logger.info(`🔧 Ejecutando job manual: ${frequency}`);

    try {
      let result;
      
      switch (frequency) {
        case 'daily':
          result = await this.executeDailyPayrolls();
          break;
        case 'weekly':
          result = await this.executeWeeklyPayrolls();
          break;
        case 'biweekly':
          result = await this.executeBiweeklyPayrolls();
          break;
        case 'monthly':
          result = await this.executeMonthlyPayrolls();
          break;
        case 'cleanup':
          result = await this.executeCleanup();
          break;
        default:
          throw new Error(`Frecuencia no soportada: ${frequency}`);
      }

      logger.info(`✅ Job manual completado: ${frequency}`, result);
      return result;

    } catch (error) {
      logger.error(`❌ Error ejecutando job manual: ${frequency}`, error);
      throw error;
    }
  }
}

// Crear instancia singleton
const payrollJob = new PayrollJob();

/**
 * Funciones de utilidad para usar en otros módulos
 */
const startPayrollJob = () => {
  return payrollJob.start();
};

const stopPayrollJob = () => {
  return payrollJob.stop();
};

const restartPayrollJob = () => {
  return payrollJob.restart();
};

const getPayrollJobStatus = () => {
  return payrollJob.getStatus();
};

const executePayrollJobManually = (frequency) => {
  return payrollJob.executeJobManually(frequency);
};

module.exports = {
  PayrollJob,
  payrollJob,
  startPayrollJob,
  stopPayrollJob,
  restartPayrollJob,
  getPayrollJobStatus,
  executePayrollJobManually
};
