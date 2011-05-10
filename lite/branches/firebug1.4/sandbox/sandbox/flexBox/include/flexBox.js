(function(){

// ************************************************************************************************

var debug = true;

// TODO: better browser detection
var supportsFlexBox = !document.all;
var isIE6 = navigator.userAgent.indexOf("MSIE 6") != -1;

// ************************************************************************************************

function FlexBox(root, listenWindowResize)
{
    var win = root.contentWindow || window;
    
    this.measure = new Measure(win);
    
    this.parentBoxObjects = [];
    
    this.root = root;
    
    initializeSplitters(this);

    if (supportsFlexBox && !debug)
    {
        this.reflow();
        return;
    }
    
    setClass(root, "boxFix");

    var self = this;
    
    var resizeTimer;
    var lastResize = 0;
    
    this.render = function()
    {
        renderBoxes(this, root);
    };
    
    var resizeHandler = this.resizeHandler = isIE6 ?
		// IE6 requires an special resizeHandler to make
		// the rendering smoother
		(function()
	    {
	        if (new Date().getTime() - lastResize > 50)
	        {
	            if (resizeTimer)
	            {
	                clearTimeout(resizeTimer);
	                resizeTimer = null;
	            }

	            self.render();

	            lastResize = new Date().getTime();
	        }
	        else
	        {
	            if (resizeTimer)
	            {
	                clearTimeout(resizeTimer);
	                resizeTimer = null;
	            }

	            resizeTimer = setTimeout(function delayedFlexBoxResize(){
	            		self.render();
	            	}, 50);
	        }
	    })
		:
		// Other IE versions
		(function(){
			self.render();
		});
    
    if (listenWindowResize)
    {
        var onunload = function(){
            removeEvent(win, "resize", resizeHandler);
            removeEvent(win, "unload", onunload);
            
            self.destroy();
        };
        
        addEvent(win, "resize", resizeHandler);
        addEvent(win, "unload", onunload);
    }
    
    self.invalidate();
    
    if (isIE6)
	{
        fixIE6BackgroundImageCache();
    	setTimeout(function delayedFlexBoxReflow(){
    		self.invalidate();
    	}, 50);
	}
}

//************************************************************************************************

FlexBox.prototype.parentBoxObjects = null;

FlexBox.prototype.reflow = function()
{
	var root = this.root;
	
    var object =
    {
        element: root,
        flex: null,
        extra: {}
    };
    
    this.parentBoxObjects = [object];
    
    reflowBoxes(this, root);
};

FlexBox.prototype.render = function(){
	
};

FlexBox.prototype.invalidate = function()
{
	this.reflow();
	this.render();
};

FlexBox.prototype.destroy = function()
{
	this.root = null;
	
	var parentBoxObjects = this.parentBoxObjects;
	var parentBoxObject;
	
	while (parentBoxObject = parentBoxObjects.pop())
	{
		parentBoxObject.element = null;
		parentBoxObject.extra = null;
		parentBoxObject.layout = null;
	}
	
	this.parentBoxObjects = null;
};

FlexBox.prototype.resizeHandler = function(){};

FlexBox.prototype.getBoxObject = function(element){
	// TODO: implement this? is it necessary to help splitters?
	var boxObject;
	
	return boxObject;
};

//************************************************************************************************

function reflowBoxes(flexBox, root)
{
    var object;
    
    var element;
    var boxSpace;
    var space;
    var flex;
    
    var padding;
    var border;
    var extraSpace;
    
    var dimensionProperty;
    var measureProperty;
    var measureBeforeProperty;
    var measureAfterProperty;
    
    var className;
    var match;
    var reFlex = /\sboxFlex(\d?)\s/;
    var reBox = /\s(v|h)box\s/;
    
    var _isIE6 = isIE6;
    
    var parentBoxObjects = flexBox.parentBoxObjects;
    
    var parentBoxObject;
    
    for (var index = 0; parentBoxObject = parentBoxObjects[index]; index++)
    {
        var box = parentBoxObject.element;
        
        var measure = flexBox.measure;
        
        var boxChildren = [];
        
        var flexSum = 0;
        var fixedSpace = 0;
        var minimumSpace = 0;
        
        var isVertical = false;
        var isHorizontal = false;
        
        if (hasClass(box, "vbox"))
        {
            isVertical = true;
            
            dimensionProperty = "height";
            measureProperty = "offsetHeight";
            measureBeforeProperty = "top";
            measureAfterProperty = "bottom";
        }
        else if (hasClass(box, "hbox"))
        {
            isHorizontal = true;
            
            dimensionProperty = "width";
            measureProperty = "offsetWidth";
            measureBeforeProperty = "left";
            measureAfterProperty = "right";
        }
        else
        {
            continue;
        }
        
        var layout = {};

        for (var i = 0, childs = box.childNodes, length = childs.length; i < length; i++)
        {
            element = childs[i];
            
            // ignore non-element nodes
            if (element.nodeType != 1) continue;
            
            className = " " + element.className + " ";
            
            padding = measure.getMeasureBox(element, "padding");
            border = measure.getMeasureBox(element, "border");
            
            extraSpace = padding[measureBeforeProperty] + padding[measureAfterProperty] +
                         border[measureBeforeProperty] + border[measureAfterProperty];
                
            if (match = reFlex.exec(className))
            {
                flex = match[1]-0 || 1;
                space = null;
            
                flexSum += flex;
                minimumSpace += extraSpace;
            }
            else
            {
                boxSpace = element[measureProperty];
                
                space = boxSpace - extraSpace;
                space = Math.max(space, 0);
                
                flex = null;
                
                fixedSpace += boxSpace;
                minimumSpace += boxSpace;
            }
            
            object =
            {
                element: element,
                flex: flex,
                extra: {},
            	layout: layout
            };
            
            object[dimensionProperty] = space;
            object.extra[dimensionProperty] = extraSpace;
            
            boxChildren.push(object);
            
            // if it is a box, then we need to layout it
            if (reBox.test(className))
            {
                parentBoxObjects.push(object);
            }
        }
        
        layout.flexSum = flexSum;
        layout.minimumSpace = minimumSpace;
        layout.fixedSpace = fixedSpace;
        
        parentBoxObject.isVertical = isVertical;
        parentBoxObject.isHorizontal = isHorizontal;
        parentBoxObject.children = boxChildren;
        parentBoxObject.layout = layout;
    }
}

//************************************************************************************************

function renderBoxes(flexBox, root)
{
    var object;
    
    var element;
    var boxSpace;
    var space;
    var flex;
    
    var padding;
    var border;
    var extraSpace;
    
    var totalSpace;
    var freeSpace;
    
    var className;
   
    var dimensionProperty;
    var measureProperty;
    var measureBeforeProperty;
    var measureAfterProperty;
    
	var _isIE6 = isIE6;
    
    var measure = flexBox.measure;
    
    var parentBoxObjects = flexBox.parentBoxObjects;
    var parentBoxObject;
    
    // render each box, followed by its children
    for (var index = 0; parentBoxObject = parentBoxObjects[index]; index++)
	{
	    var computedSpace = 0;
	    var remainingPixels = 0;
	    
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
	    // restore data from the parentBoxObjects cache
	    
        var box = parentBoxObject.element;
        var objects = parentBoxObject.children;
        var isVertical = parentBoxObject.isVertical;
        var isHorizontal = parentBoxObject.isHorizontal;
        
        var flexSum = parentBoxObject.layout.flexSum;
        var fixedSpace = parentBoxObject.layout.fixedSpace;;
        var minimumSpace = parentBoxObject.layout.minimumSpace;;
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
	    // initialize measure / dimension variables
        
        if (isVertical)
        {
            dimensionProperty = "height";
            measureProperty = "offsetHeight";
            measureBeforeProperty = "top";
            measureAfterProperty = "bottom";
        }
        else if (isHorizontal)
        {
            dimensionProperty = "width";
            measureProperty = "offsetWidth";
            measureBeforeProperty = "left";
            measureAfterProperty = "right";
        }
        else
        {
            continue;
        }
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    	// calculating the total space
        
        extraSpace = parentBoxObject.extra[dimensionProperty];
        if (!extraSpace)
        {
            padding = measure.getMeasureBox(box, "padding");
            border = measure.getMeasureBox(box, "border");
            
            extraSpace = padding[measureBeforeProperty] + padding[measureAfterProperty] +
                         border[measureBeforeProperty] + border[measureAfterProperty];
        }
        
        // We are setting the height of horizontal boxes in IE6, so we need to 
        // temporary hide the elements otherwise we will get the wrong measures
        if (_isIE6)
        {
            className = box.className;
            box.className = className + " boxFixIgnoreContents";
            space = box[measureProperty];
            box.className = className;
        }
        else
        {
            space = box[measureProperty];
        }
        
        totalSpace = space - extraSpace;
        
        freeSpace = totalSpace - fixedSpace;
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // processing box children
        
        for (var i = 0, length = objects.length; i < length; i++)
        {
            object = objects[i];
            
            element = object.element;
            flex = object.flex;
            extraSpace = object.extra[dimensionProperty];
            
            // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
            // calculating child size
            
            // if it is a flexible child, then we need to calculate its space
            if (flex)
            {
            	// calculate the base flexible space
                space = Math.floor(freeSpace * flex / flexSum);
                space -= extraSpace;
                space = Math.max(space, 0);
                
                // calculate the remaining pixels
                remainingPixels = freeSpace * flex % flexSum;
                
                // distribute remaining pixels
                if (remainingPixels > 0 && computedSpace + space + remainingPixels <= totalSpace)
                {
                	// distribute a proportion of the remaining pixels, 
                	// with a minimum value of 1 pixel
                    space += Math.floor(remainingPixels * flex / flexSum) || 1;
                }
                
                // save the value
                object[dimensionProperty] = space;
            }
            // if it is not a flexible child, then we already have its dimension calculated
            else
            {
        		// use the value calculated at the last reflow() operation
                space = object[dimensionProperty];
            }

            // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
            // resizing child if necessary
            
            if (isHorizontal || flex)
            {
                if (isVertical)
                {
                	// if it's a child of a vertical box, then we only need to adjust the height...
                    element.style.height = space + "px";
                    
                    // unless...
                    
                    // xxxpedro 100% width of an iframe with border will exceed the width of 
                    // its offsetParent... don't ask me why. not sure though if this 
                    // is the best way to solve it
                    if (element.nodeName.toLowerCase() == "iframe")
                    {
                        border = measure.getMeasureBox(element, "border");
                    	
                        // in IE6 we need to hide the iframe in order to get the correct 
                        // width of its parentNode
                    	if (isIE6) 
                		{
                    		element.style.display = "none";
                            boxSpace = element.parentNode.offsetWidth;
                            element.style.display = "block";
                		}
                        else
                    	{
                            boxSpace = element.parentNode.offsetWidth;
                    	}

                    	// remove the border space
                        element.style.width = Math.max(0, boxSpace - border.left - border.right) + "px";
                    }
                }
                else
                {
                    setClass(element, "boxFixPos");
                    
                    element.style.left = computedSpace + "px";
                    element.style.width = space + "px";
                    
                    // parentBoxObject.height IE6 only
                    if (_isIE6)
                    {
                        // TODO: figure out how to solve the problem with minimumSpace
                        object.height = parentBoxObject.height || box.offsetHeight;
                        element.style.height = object.height + "px";
                    }
                }
            }
            
            // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
            // update the computed space sum
            
            computedSpace += space;
        }
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // Ensuring minimum space
        
        if (box != root && isVertical)
        {
            // TODO: check for "deeper" parents
        	// here we are enforcing that the parent box dimension (height or width) won't be smaller than
        	// the minimum space required, which is the sum of fixed dimension child boxes
            box.parentNode.style[dimensionProperty] = Math.max(box.parentNode[measureProperty], minimumSpace) + "px";
        }    	
	}

}

//************************************************************************************************

window.splitters = [];

function initializeSplitters(flexBox)
{
	var doc = flexBox.root.ownerDocument;
	var elements = flexBox.root.getElementsByTagName("div");
	var element;
	
	for (var i=0, l=elements.length; i<l; i++)
	{
		element = elements[i];
		if (hasClass(element, "fbSplitter"))
		{
			var targetId = element.getAttribute("data-target");
			var spacerId = element.getAttribute("data-spacer");
			
			var target = doc.getElementById(targetId);
			var spacer = doc.getElementById(spacerId);
			
			splitters.push(new Splitter(flexBox, element, target, spacer));
		}
	}
}

window.Splitter = function Splitter(flexBox, splitter, target, spacer)
{
	this.flexBox = flexBox;
	
	this.splitter = splitter;
	this.target = target;
	this.spacer = spacer;
	
	this.document = splitter.ownerDocument;
	this.window = this.document.parentWindow || this.document.defaultView;
	
	this.splitterFrame = this.document.createElement("div");
	this.splitterFrame.className = "splitterFrame";
	
	var self = this;
	
	splitter.onmousedown = function(event)
	{
		self.onSplitterMouseDown(event);
	};
};

Splitter.prototype.onSplitterMouseDown = function(e) 
{
	cancelEvent(e, true);
	//console.log(e);
	
	var flexBox = this.flexBox;
	var splitterFrame = this.splitterFrame;
	
	var root = flexBox.root;
	var measure = flexBox.measure;
	
	var winSize = measure.getWindowSize();
	var target = this.target;
	var self = this;
	
	//console.log(measure.getElementPosition(this.target));
	
	var box = measure.getElementBox(root);
	
	openSplitterFrame(this);
	
	this.splitterFrame.onmousemove = function(event)
	{
		//console.log(event);
		event =  window.event || event;
		var clientX = event.clientX;
		
		//console.log(clientX, winSize.width, Math.max(0, winSize.width-clientX));
		target.style.width = Math.max(0, winSize.width-clientX-2) + "px";
		
        if (isIE6)
        {
            var className = target.className;
            target.className = className + " boxFixIgnoreContents";
            flexBox.invalidate();
            target.className = className;
        }
        else
        	flexBox.invalidate();
        
		//openSplitterFrame(self);
	};
	
	this.splitterFrame.onmouseup = function(event)
	{
		event =  window.event || event;
		
		//console.log(event);
		closeSplitterFrame(self);
		
		try
		{
			self.splitter.style.cursor = "default";
			setTimeout(function(){
			self.splitter.style.cursor = "e-resize";
			self.splitter.focus();
			},0);
		}
		catch(E)
		{
			
		}
		
		return false;
	};
};

function openSplitterFrame(splitter) {
	var flexBox = splitter.flexBox;
	var root = flexBox.root;
	var splitterFrame = splitter.splitterFrame;
	
	var box = flexBox.measure.getElementBox(root);
	for (var prop in box)
	{
		splitterFrame.style[prop] = box[prop] + "px";
	}
	
	if (debug)
	{
		//splitterFrame.style.background = "#def";
		//splitterFrame.style.opacity = 0.5;
	}
	
	splitterFrame.style.cursor = "e-resize";
	
	root.parentNode.insertBefore(splitterFrame, root);
	//root.appendChild(splitterFrame);
}

function closeSplitterFrame(splitter) {
	var root = splitter.flexBox.root;
	var splitterFrame = splitter.splitterFrame;
	
	splitterFrame.style.cursor = "inherit";
	
	root.parentNode.removeChild(splitterFrame);
	//root.removeChild(splitterFrame);
}


// ************************************************************************************************
// helper classes

function hasClass(node, name)
{
    return (' '+node.className+' ').indexOf(' '+name+' ') != -1;
}

function setClass(node, name)
{
    if (node && (' '+node.className+' ').indexOf(' '+name+' ') == -1)
        node.className += " " + name;
}

function addEvent(object, name, handler, useCapture)
{
    if (object.addEventListener)
        object.addEventListener(name, handler, useCapture);
    else
        object.attachEvent("on"+name, handler);
}

function removeEvent(object, name, handler, useCapture)
{
    if (object.removeEventListener)
        object.removeEventListener(name, handler, useCapture);
    else
        object.detachEvent("on"+name, handler);
}

function cancelEvent(e, preventDefault)
{
    if (!e) return;
    
    if (preventDefault)
    {
        if (e.preventDefault)
            e.preventDefault();
        else
            e.returnValue = false;
    }
    
    if (e.stopPropagation)
        e.stopPropagation();
    else
        e.cancelBubble = true;
}

// ************************************************************************************************
// IE6 background glitch fix
// http://www.mister-pixel.com/#Content__state=is_that_simple

var fixIE6BackgroundImageCache = function(doc)
{
    doc = doc || document;
    try
    {
        doc.execCommand("BackgroundImageCache", false, true);
    } 
    catch(E) {}
};

// ************************************************************************************************

window.FlexBox = FlexBox;

// ************************************************************************************************
})();