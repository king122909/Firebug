/*******************************************************************************
 * Copyright (c) 2010, 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License v1.0
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html).
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
/*global eclipse:true orion:true dojo window*/
/*jslint devel:true*/

dojo.addOnLoad(function(){

    var editorContainerDomNode = dojo.byId("editorContainer");

    var editorFactory = function() {
        return new orion.textview.TextView({
            parent: editorContainerDomNode,
            stylesheet: ["/orion/textview/textview.css", "/orion/textview/rulers.css", "/examples/textview/textstyler.css", "/examples/editor/htmlStyles.css"],
            tabSize: 4
        });
    };

    var contentAssistFactory = function(editor) {
        var contentAssist = new orion.editor.ContentAssist(editor, "contentassist");
        contentAssist.addProvider(new orion.editor.CssContentAssistProvider(), "css", "\\.css$");
        contentAssist.addProvider(new orion.editor.JavaScriptContentAssistProvider(), "js", "\\.js$");
        return contentAssist;
    };

    // Canned highlighters for js, java, and css. Grammar-based highlighter for html
    var syntaxHighlighter = {
        styler: null,

        highlight: function(fileName, editorWidget) {
            if (this.styler) {
                this.styler.destroy();
                this.styler = null;
            }
            if (fileName) {
                var splits = fileName.split(".");
                var extension = splits.pop().toLowerCase();
                if (splits.length > 0) {
                    switch(extension) {
                        case "js":
                            this.styler = new examples.textview.TextStyler(editorWidget, "js");
                            break;
                        case "java":
                            this.styler = new examples.textview.TextStyler(editorWidget, "java");
                            break;
                        case "css":
                            this.styler = new examples.textview.TextStyler(editorWidget, "css");
                            break;
                        case "html":
                            this.styler = new orion.editor.TextMateStyler(editorWidget, orion.editor.HtmlGrammar.grammar);
                            break;
                    }
                }
            }
        }
    };

    var annotationFactory = new orion.editor.AnnotationFactory();

    function save(editor) {
        editor.onInputChange(null, null, null, true);
        window.alert("Save hook.");
    }

    var keyBindingFactory = function(editor, keyModeStack, undoStack, contentAssist) {

        // Create keybindings for generic editing
        var genericBindings = new orion.editor.TextActions(editor, undoStack);
        keyModeStack.push(genericBindings);

        // create keybindings for source editing
        var codeBindings = new orion.editor.SourceCodeActions(editor, undoStack, contentAssist);
        keyModeStack.push(codeBindings);

        // save binding
        editor.getEditorWidget().setKeyBinding(new orion.textview.KeyBinding("s", true), "save");
        editor.getEditorWidget().setAction("save", function(){
                save(editor);
                return true;
        });

        // speaking of save...
        dojo.byId("save").onclick = function() {save(editor);};

    };

    var dirtyIndicator = "";
    var status = "";

    var statusReporter = function(message, isError) {
        if (isError) {
            status =  "ERROR: " + message;
        } else {
            status = message;
        }
        dojo.byId("status").innerHTML = dirtyIndicator + status;
    };

    var editorContainer = new orion.editor.Editor({
        editorFactory: editorFactory,
        undoStackFactory: new orion.editor.UndoFactory(),
        annotationFactory: annotationFactory,
        lineNumberRulerFactory: new orion.editor.LineNumberRulerFactory(),
        contentAssistFactory: contentAssistFactory,
        keyBindingFactory: keyBindingFactory,
        statusReporter: statusReporter,
        domNode: editorContainerDomNode
    });

    dojo.connect(editorContainer, "onDirtyChange", this, function(dirty) {
        if (dirty) {
            dirtyIndicator = "*";
        } else {
            dirtyIndicator = "";
        }
        dojo.byId("status").innerHTML = dirtyIndicator + status;
    });

    editorContainer.installEditor();


    // if there is a mechanism to change which file is being viewed, this code would be run each time it changed.
    var contentName = "sample.js";  // for example, a file name, something the user recognizes as the content.
    var initialContent = "window.alert('this is some javascript code');  // try pasting in some real code";
    editorContainer.onInputChange(contentName, null, initialContent);
    syntaxHighlighter.highlight(contentName, editorContainer.getEditorWidget());
    // end of code to run when content changes.

    var editorProxy = {
        connect: function()
        {
            this.model = editorContainer.getEditorWidget().getModel();
            this.model.addListener(this);
            this.empty = true;
        },
        disconnect: function()
        {
            this.model.removeListener(this);
        }
    };


    var editorProxyForCSS = {
        connect: editorProxy.connect,
        disconnect: editorProxy.disconnect,

        // eclipse.TextModel listener
        onChanged: function(start, removedCharCount, addedCharCount, removedLineCount, addedLineCount)
        {
            console.log("editorProxyForCSS onChanged ", arguments);
            syntaxHighlighter.highlight(contentName, editorContainer.getEditorWidget());
            if (this.empty) // then this is the first event
            {
                editorContainerDomNode.addEventListener("DOMNodeRemoved", function onNodeRemoved(event)
                {
                    console.log("DOMNodeRemoved ", event);
                }, true);
                delete this.empty;  // mark seen first event
                return;             // drop first event, its just the initial buffer load
            }

            var changedLineIndex = this.model.getLineAtOffset(start);
            var lineText = this.model.getLine(changedLineIndex);
            connection.callService("IStylesheet", "onRuleLineChanged", [changedLineIndex, lineText]);
        },
    };

    function objectReceiver(props) {

        if (window.FBTrace)
            console.log("orionEditorAdapter received object ", props);
        else
            console.log("orionEditorAdapter received object ", props);

        editorProxyForCSS.connect();  // start event flow into proxy
console.log('orionEditorAdapter before orion ready message')
        connection.postObject({connection: "orion is ready"});
        console.log("orion posted ready");
    }

    var connection = jsonConnection.add(document.documentElement, objectReceiver);

    // For events from dyne to orion
    connection.registerService("IEditor", null, editorContainer);
    document.documentElement.addEventListener("DOMNodeRemoved", function onNodeRemoved(event)
    {
        console.log("global DOMNodeRemoved ", event);
    }, true);
    document.documentElement.addEventListener("DOMNodeInserted", function onNodeRemoved(event)
    {
        console.log("global DOMNodeInserted ", event);
    }, true);
    document.documentElement.addEventListener("DOMAttrModified", function onNodeRemoved(event)
    {
        console.log("global DOMAttrModified ", event);
    }, true);

    alert("before leaving page");
    window.onbeforeunload = function() {
        if (editorContainer.isDirty()) {
             return "There are unsaved changes.";
        }
    };
});
