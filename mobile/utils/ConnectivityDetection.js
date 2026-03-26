/**
 * @fileoverview ConnectivityDetection.js
 * @description Enterprise-grade connectivity detection with health checks
 * @author UniPass Security Team
 *
 * Implements intelligent connectivity detection with:
 * - Fast health check (500ms timeout)
 * - Exponential backoff retry logic
 * - Connection quality metrics
 * - Event-driven architecture
 */

class ConnectivityDetector {
  constructor(config = {}) {
    this.healthEndpoint = config.healthEndpoint || '/api/health';
    this.baseURL = config.baseURL || 'http://localhost:3000';
    this.timeout = config.timeout || 500; // 500ms for fast fail
    this.retryAttempts = config.retryAttempts || 3;
    this.isOnline = true;
    this.lastCheckTimestamp = null;
    this.listeners = new Set();
    this.checkInterval = null;

    // Connection quality metrics
    this.metrics = {
      latency: 0,
      consecutiveFailures: 0,
      lastSuccessTime: Date.now(),
    };
  }

  /**
   * Performs a health check against the backend
   * @returns {Promise<{online: boolean, latency: number, timestamp: number}>}
   */
  async checkHealth() {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseURL}${this.healthEndpoint}`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Type': 'UniPass-Mobile',
        },
      });

      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;
      this.lastCheckTimestamp = Date.now();

      if (response.ok) {
        const data = await response.json();
        this.metrics.latency = latency;
        this.metrics.consecutiveFailures = 0;
        this.metrics.lastSuccessTime = Date.now();

        this._updateStatus(true);

        return {
          online: true,
          latency,
          timestamp: this.lastCheckTimestamp,
          serverStatus: data.status || 'healthy',
          serverTime: data.timestamp,
        };
      } else {
        throw new Error(`Health check failed: ${response.status}`);
      }
    } catch (error) {
      this.metrics.consecutiveFailures++;
      this._updateStatus(false);

      return {
        online: false,
        latency: Date.now() - startTime,
        timestamp: Date.now(),
        error: error.message,
        failureCount: this.metrics.consecutiveFailures,
      };
    }
  }

  /**
   * Checks connectivity with exponential backoff retry
   * @param {number} attempt - Current retry attempt
   * @returns {Promise<boolean>}
   */
  async checkWithRetry(attempt = 0) {
    const result = await this.checkHealth();

    if (result.online) {
      return true;
    }

    if (attempt < this.retryAttempts) {
      const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 5000);
      await this._sleep(backoffDelay);
      return this.checkWithRetry(attempt + 1);
    }

    return false;
  }

  /**
   * Starts continuous monitoring
   * @param {number} interval - Check interval in milliseconds (default: 10000)
   */
  startMonitoring(interval = 10000) {
    if (this.checkInterval) {
      this.stopMonitoring();
    }

    // Initial check
    this.checkHealth();

    this.checkInterval = setInterval(() => {
      this.checkHealth();
    }, interval);
  }

  /**
   * Stops continuous monitoring
   */
  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Subscribe to connectivity status changes
   * @param {Function} listener - Callback function(isOnline, metrics)
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback);

    // Immediately emit current state to avoid undefined UI state on first render.
    callback(this.isOnline, this.metrics);

    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Updates online status and notifies listeners
   * @private
   */
  _updateStatus(isOnline) {
    if (this.isOnline !== isOnline) {
      this.isOnline = isOnline;
      this._notifyListeners();
    }
  }

  /**
   * Calculates connection quality score (0-100)
   * @returns {number}
   */
  getConnectionQuality() {
    if (!this.isOnline) return 0;

    const { latency, consecutiveFailures } = this.metrics;

    let quality = 100;
    if (latency > 1000) quality = 30;
    else if (latency > 500) quality = 60;
    else if (latency > 200) quality = 80;

    quality -= consecutiveFailures * 10;

    return Math.max(0, Math.min(100, quality));
  }

  /**
   * Determines if offline mode should be used.
   * @returns {boolean}
   */
  shouldUseOfflineMode() {
    return !this.isOnline || this.getConnectionQuality() < 30;
  }

  /**
   * Private: Notifies all subscribers.
   * @private
   */
  _notifyListeners() {
    this.listeners.forEach((callback) => {
      try {
        callback(this.isOnline, this.metrics);
      } catch (error) {
        console.error('Error in connectivity listener:', error);
      }
    });
  }

  /**
   * Gets diagnostic information.
   * @returns {Object}
   */
  getDiagnostics() {
    return {
      isOnline: this.isOnline,
      metrics: { ...this.metrics },
      lastCheckTimestamp: this.lastCheckTimestamp,
      connectionQuality: this.getConnectionQuality(),
      timeSinceLastSuccess: Date.now() - this.metrics.lastSuccessTime,
      isMonitoring: this.checkInterval !== null,
    };
  }

  /**
   * Sleep utility for retry backoff
   * @private
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const createConnectivityDetector = (config) => {
  return new ConnectivityDetector(config);
};

export default ConnectivityDetector;
