/**
 * Software License Agreement (BSD License)
 * 
 * Copyright (c) 2010 IBM Corporation.
 * All rights reserved.
 * 
 * Redistribution and use of this software in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 * 
 * * Redistributions of source code must retain the above
 *   copyright notice, this list of conditions and the
 *   following disclaimer.
 * 
 * * Redistributions in binary form must reproduce the above
 *   copyright notice, this list of conditions and the
 *   following disclaimer in the documentation and/or other
 *   materials provided with the distribution.
 * 
 * * Neither the name of IBM nor the names of its
 *   contributors may be used to endorse or promote products
 *   derived from this software without specific prior
 *   written permission of IBM.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
 * FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT
 * OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * An implementation of a {@link BrowserContext} for the command line debugger example.
 * 
 * @constructor
 * @param id unique execution context identifier, a {@link String} that cannot be <code>null</code>
 * @param url the URL associated with this context
 * @param browser the browser that contains the execution context
 * @type CFBrowserContext
 * @return a {@link CFBrowserContext}
 * @version 1.0
 */
function CFBrowserContext(id, url, browser) {
	BrowserContext.call(this, id, url, browser);
	this.initialized = false;
	this.executionContext = new CFExecutionContext(this);
}

/** 
 * {@link CFBrowserContext} is a subclass of BrowserContext
 */

CFBrowserContext.prototype = subclass(BrowserContext.prototype);

/**
 * Override {@link JavaScriptContext} implementation
 */
CFBrowserContext.prototype.getCompilationUnits = function(listener) {
	if (this.initialized) {
		// no need to retrieve scripts
		listener.call(null, this._getCompilationUnits());
		return;
	}
	// not initialized - retrieve scripts
	var handler = function(response) {
		var scripts = response["body"]["scripts"];
		if (scripts) {
			for ( var i = 0; i < scripts.length; i++) {
				var cu = new CFCompilationUnit(scripts[i]["script"]["id"], this);
				this._addCompilationUnit(cu);
			}
		}
		this.initialized = true;
		listener.call(null, this._getCompilationUnits());
	};
	this.getBrowser()._sendRequest({"command":"scripts", "context_id":this.getId(), "arguments":{"includeSource": false}}, this, handler);
};

/**
 * Notification a script has been compiled. Retrieves the rest of the script information.
 * 
 * @function
 * @param cu the URL of the script as a {@link String} 
 */
CFBrowserContext.prototype._scriptCompiled = function(url) {
	var cu = new CFCompilationUnit(url, this);
	this._addCompilationUnit(cu);
};

/**
 * Override implementation from super class.
 * 
 * @returns a {CFExecutionContext}
 */
CFBrowserContext.prototype.getJavaScriptContext = function() {
	return this.executionContext;
};