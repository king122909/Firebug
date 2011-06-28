function runTest()
{
    FBTest.sysout("issue3652.START");
    FBTest.openNewTab(basePath + "css/3652/issue3652.html", function(win)
    {
        FBTest.openFirebug();
        FBTest.selectPanel("html");

        FBTest.selectElementInHtmlPanel("element1", function(node)
        {
            var panel = FBTest.selectSidePanel("css");
            var values = panel.panelNode.querySelectorAll(".cssPropValue");
            FBTest.compare(0, !values.length, "There must be at least one CSS value.");

            // Click the CSS value to open the inline editor.
            FBTest.synthesizeMouse(values[1]);

            // Type 'r' and verify auto completion.
            var editor = panel.panelNode.querySelector(".textEditorInner");
            FBTest.sendChar("r", editor);
            FBTest.compare("red", editor.value, "Must be autocompleted to red.");

            // Testing up and down arrows covers issue 3671
            // Type 'arrow-up' and verify completion (should be the previous
            // color starting with 'r').
            FBTest.sendKey("UP", editor);
            FBTest.compare("royalBlue", editor.value, "Must be autocompleted to royalBlue.");

            // Type 'arrow-down' and verify completion.
            FBTest.sendKey("DOWN", editor);
            FBTest.compare("red", editor.value, "Must be autocompleted again to red.");

            // Type 'home' to move the cursor at the beginning and cancel the selection.
            // Consequently type 'arrow-up' to get the (global) previous color.
            // DOM_VK_HOME doesn't work on MAC, press left 3x instead.
            FBTest.sendKey("LEFT", editor);
            FBTest.sendKey("LEFT", editor);
            FBTest.sendKey("LEFT", editor);

            FBTest.sendKey("UP", editor);
            FBTest.compare("Purple", editor.value, "Must be autocompleted to Purple and it's: " + editor.value);

            // And again go back to 'Red' (now with capital R)
            FBTest.sendKey("DOWN", editor);
            FBTest.compare("Red", editor.value, "Must be autocompleted to Red.");

            FBTest.testDone("issue3652.DONE");
        });
    });
}