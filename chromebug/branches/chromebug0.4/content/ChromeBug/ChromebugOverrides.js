/* See license.txt for terms of usage */


FBL.ns(function chromebug() { with (FBL) {
	
const Ci = Components.interfaces;	
const nsIDOMDocumentXBL = Ci.nsIDOMDocumentXBL;	
	
var ChromeBugWindowInfo = Firebug.Chromebug.xulWindowInfo;

var reComponents = /:.*\/([^\/]*)\/components\//;
var ChromeBugOverrides = {

    //****************************************************************************************
    // Overrides

    // Override FirebugChrome.syncTitle
    syncTitle: function()
    {
        window.document.title = "ChromeBug";
        if (window.Application)
            window.document.title += " in " + Application.name + " " +Application.version;
        FBTrace.sysout("Chromebug syncTitle"+window.document.title+"\n");
    },

    // Override Firebug.HTMLPanel.prototype
    getParentObject: function(node)
    {
        if (node instanceof SourceText)
            return node.owner;

        var parentNode = node ? node.parentNode : null;
        if (FBTrace.DBG_HTML) FBTrace.sysout("ChromeBugPanel.getParentObject for "+node.localName+" parentNode:"+(parentNode?parentNode.localName:"null-or-false")+"\n");

        if (parentNode)
        {
            if (!parentNode.localName)
            {
                if (FBTrace.DBG_HTML) FBTrace.sysout("ChromeBugPanel.getParentObject null localName must be window\n");
                return null;
            }
            if (FBTrace.DBG_HTML) FBTrace.sysout("ChromeBugPanel.getParentObject if(parentNode):"+(parentNode?parentNode.localName:"null-or-false")+"\n");
            if (parentNode.nodeType == 9) // then parentNode is Document element
            {
                if (this.embeddedBrowserParents)
                {
                    var skipParent = this.embeddedBrowserParents[node];  // better be HTML element, could be iframe
                    if (FBTrace.DBG_HTML) FBTrace.sysout("ChromeBugPanel.getParentObject skipParent:"+(skipParent?skipParent.localName:"none")+"\n");                  /*@explore*/
                    if (skipParent)
                        return skipParent;
                }
                if (parentNode.defaultView)
                {
                    if (FBTrace.DBG_HTML) FBTrace.sysout("ChromeBugPanel.getParentObject parentNode.nodeType 9, frameElement:"+parentNode.defaultView.frameElement+"\n");                  /*@explore*/
                    return parentNode.defaultView.frameElement;
                }
                else // parent is document element, but no window at defaultView.
                    return null;
            }
            else
                return parentNode;
        }
        else  // Documents have no parent node;Attr, Document, DocumentFragment, Entity, and Notation. top level windows have no parentNode
        {
            if (node && node.nodeType == 9) // document type
            {
                if (node.defaultView) // generally a reference to the window object for the document, however that is not defined in the specification
                {
                    var embeddingFrame = node.defaultView.frameElement;
                    if (embeddingFrame)
                        return embeddingFrame.parentNode;
                }
                else // a Document object without a parentNode or window
                    return null;  // top level has no parent
            }
        }
    },

    getChildObject: function(node, index, previousSibling)
    {
        if (!node)
        {
            FBTrace.dumpStack("null node to getChildObject");
            return;
        }
var header = "ChromeBugPanel.getChildObject, node:"+node.localName+" index="+index+" prev="+(previousSibling?previousSibling.tagName:"null")+" result:";
        // We assume that the first call will have index = 0 and previousSibling = null;
        var result = null;
        if (this.isSourceElement(node))
        {
            if (index == 0)
                return this.getElementSourceText(node);
        }
        else if (previousSibling)  // then we are walking, anonymous or not
        {
            return echo(header,  this.findNextSibling(previousSibling) );
        }
        else // we need to start an iteration
        {
            var doc = node.ownerDocument;
            if (doc instanceof nsIDOMDocumentXBL)
            {
                var anonymousChildren = doc.getAnonymousNodes(node);
                if (anonymousChildren)
                {
                    if (node.__walkingAnonymousChildren) // then we are done walking anonymous
                    {
                        FBTrace.sysout("ChromeBugPanel.getChildObject done anonymous \n");
                        delete node.__walkingAnonymousChildren;
                    }
                    else
                    {
                        FBTrace.sysout("ChromeBugPanel.getChildObject starting on anonymous "+anonymousChildren.length+"\n");
                        node.__walkingAnonymousChildren = true;
                        return echo(header, anonymousChildren[0]);
                    }
                }
            }
            // Not a DocumentXBL or no anonymousChildren or we walked all of them.
            // On to regular nodes

            if (node.contentDocument)
            {
                if (!this.embeddedBrowserParents)
                    this.embeddedBrowserParents = {};
                var skipChild = node.contentDocument.documentElement; // unwrap
                this.embeddedBrowserParents[skipChild] = node;

                 result = node.contentDocument.documentElement;  // (the node's).(type 9 document).(HTMLElement)
                 /*
                 FBTrace.dumpProperties("ChromeBugPanel.getChildObject for no prev yes contentDocument this.embeddedBrowserParents: ", this.embeddedBrowserParents);
                 FBTrace.dumpProperties("ChromeBugPanel.getChildObject for no prev yes contentDocument node.parentNode: ", node.parentNode);
                 FBTrace.dumpProperties("ChromeBugPanel.getChildObject for no prev yes contentDocument node: ", node);
                 FBTrace.dumpProperties("ChromeBugPanel.getChildObject for no prev yes contentDocument node.contentDocument: ", node.contentDocument);
                 FBTrace.dumpProperties("ChromeBugPanel.getChildObject for no prev yes contentDocument documentElement: ", result);
                 */
            }
            else if (Firebug.showWhitespaceNodes)
                result = node.childNodes[index];
            else
            {
                var childIndex = 0;
                for (var child = node.firstChild; child; child = child.nextSibling)
                {
                    if (!this.isWhitespaceText(child) && childIndex++ == index)
                        result = child;
                }
            }
        }

        return echo(header ,result);
    },

    getAnonymousChildObject: function(node, document)
    {
        if (FBTrace.DBG_HTML)
                FBTrace.sysout("ChromeBugPanel.getAnonymousChildObject for "+node.localName+" children: ");

        var anonymousChildren = document.getAnonymousNodes(node);
        if (anonymousChildren)
        {
            if(node.__walkingAnonymousChildren)  // second time we ran out of siblings
            {
                if (FBTrace.DBG_HTML)
                    FBTrace.sysout("DONE \n");
                delete node.__walkingAnonymousChildren
                return null;
            }
            else // first time
            {
                FBTrace.sysout(anonymousChildren.length+" \n");
                node.__walkingAnonymousChildren = true;
                return anonymousChildren[0];  // this will start us on another loop using previousSibling
            }
        }
        if (FBTrace.DBG_HTML)
            FBTrace.sysout(" none\n");
    },

    // Override debugger
    supportsWindow: function(win)
    {
        try {
            var xulWindowInfo = ChromeBugWindowInfo;
            var context = (win ? xulWindowInfo.getContextByDOMWindow(win, true) : null);

            if (context && context.globalScope instanceof ContainedDocument)
            {
                if (context.window.Firebug)  // Don't debug, let Firebug do it.
                    return false;
            }

            if (FBTrace.DBG_STACK) FBTrace.sysout("ChromeBugPanel.supportsWindow win.location.href: "+((win && win.location) ? win.location.href:"null")+ " context:"+context+"\n");
            this.breakContext = context;
            return !!context;
        }
        catch (exc)
        {
            FBTrace.dumpProperties("ChromebugPanel.supportsWindow FAILS", exc);
            return false;
        }
    },

    // Override debugger
    supportsGlobal: function(global)
    {
        try {
            var context = ChromeBugWindowInfo.getContextByGlobal(global);
            if (!context)
            {
                if (global.location)  // then we have a window, it will be an nsIDOMWindow, right?
                {
                    var location = global.location.toString();
                    if (location.indexOf("chrome://chromebug/") != -1)
                        return false;
                    if (location.indexOf("chrome:") != 0)
                        return false; // That is the "chrome" in ChromeBug ;-)

                    var rootDOMWindow = getRootWindow(global);
                    if (rootDOMWindow.location.toString().indexOf("chrome://chromebug") != -1)
                        return false;  // eg panel.html in chromebug

                    context = ChromeBugWindowInfo.createContextForDOMWindow(global);
                    var gs = new FrameGlobalScopeInfo(global, context);
                    Firebug.Chromebug.globalScopeInfos.add(context, gs);
                }
                else
                {
                    if (FBTrace.DBG_CHROMEBUG && FBTrace.DBG_WINDOWS)
                       FBTrace.sysout("ChromeBugPanel.supportsGlobal but no context and ", "no location");
                }
            }

            this.breakContext = context;
            return !!context;
        }
        catch (exc)
        {
           FBTrace.dumpProperties("supportsGlobal FAILS:", exc);
        }

    },

    // Override FBL

    skipSpy: function(win)
    {
        var uri = win.location.href; // don't attach spy to chromebug
        if (uri &&  uri.indexOf("chrome://chromebug") == 0)
                return true;
    },

    isHostEnabled: function(context)
    {
        return true; // Chromebug is always enabled for now
    },

    suspendFirebug: function()
    {
        // TODO if possible.
        FBTrace.sysout("ChromebugPanel.suspendFirebug\n");
    },

    resumeFirebug: function()
    {
        // TODO if possible.
        FBTrace.sysout("ChromebugPanel.resumeFirebug\n");
    }
};
//**************************************************************************
function overrideFirebugFunctions()
{
    try {
        // Apply overrides
        top.Firebug.prefDomain = "extensions.chromebug";
        top.Firebug.HTMLPanel.prototype.getParentObject = ChromeBugOverrides.getParentObject;
        top.Firebug.HTMLPanel.prototype.getChildObject = ChromeBugOverrides.getChildObject;
        top.Firebug.HTMLPanel.prototype.getAnonymousChildObject = ChromeBugOverrides.getAnonymousChildObject;
        top.Firebug.Debugger.supportsWindow = ChromeBugOverrides.supportsWindow;
        top.Firebug.Debugger.supportsGlobal = ChromeBugOverrides.supportsGlobal;
        top.Firebug.showBar = function() {
            if (FBTrace.DBG_CHROMEBUG)
                FBTrace.sysout("ChromeBugPanel.showBar NOOP\n");
        }

        Firebug.Spy.skipSpy = ChromeBugOverrides.skipSpy;
        Firebug.ActivableModule.isHostEnabled = ChromeBugOverrides.isHostEnabled;
        Firebug.suspendFirebug = ChromeBugOverrides.suspendFirebug;
        Firebug.resumeFirebug = ChromeBugOverrides.resumeFirebug;

        // Trace message coming from Firebug should be displayed in Chromebug's panel
        //
        Firebug.setPref("extensions.firebug", "enableTraceConsole", "panel");

        dump("ChromebugPanel Overrides applied"+"\n");
    }
    catch(exc)
    {
        dump("ChromebugPanel override FAILS "+exc+"\n");
    }
}

function echo(header, elt)
{
    if (FBTrace.DBG_HTML && elt)
        FBTrace.sysout(header + (elt ? elt.localName:"null")+"\n");
    return elt;
}

overrideFirebugFunctions();
}});