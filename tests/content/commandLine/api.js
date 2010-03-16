function runTest()
{
    FBTest.sysout("commandline.api.START");
    FBTest.openNewTab(basePath + "commandLine/api.html", function(win)
    {
        FBTest.openFirebug();
        FBTest.clearCache();
        FBTest.enableConsolePanel(function(win)
        {
            var tasks = new FBTest.TaskList();

            // Every task defined below, executes an expression on the command
            // line and verifies the displayed output in the console.
            // See executeAndVerify method below for description of individual
            // parameters.

            tasks.push(executeAndVerify, "$(\"test1\")", "<div id=\"test1\">",
                "a", "objectLink objectLink-element");

            tasks.push(executeAndVerify, "$$(\".a.c\")", "[div.a, div.a]",
                "span", "objectBox objectBox-array");

            tasks.push(executeAndVerify, "$x(\"html/body/span/div[1]\")", "[div.test]",
                "span", "objectBox objectBox-array");

            tasks.push(executeAndVerify, "dir(a)", /\s*a\s*10\s*/,
                "table", "domTable");

            tasks.push(executeAndVerify, "dirxml($('test3'))",
                "<div id=\"test3\"><div></div></div>",
                "div", "logRow logRow-dirxml");

            tasks.push(executeAndVerify, "keys(b)", "[\"a\", \"name\"]",
                "span", "objectBox objectBox-array");

            tasks.push(executeAndVerify, "values(b)", "[7, \"a\"]",
                "span", "objectBox objectBox-array");

            tasks.run(function() {
                FBTest.testDone("commandline.api.DONE");
            });
        });
    });
}

/**
 * Helper function for executing expression on the command line.
 * @param {Function} callback Appended by the test harness.
 * @param {String} expression Expression to be executed.
 * @param {String} expected Expected value displayed.
 * @param {String} tagName Name of the displayed element.
 * @param {String} class Class of the displayed element.
 */
function executeAndVerify(callback, expression, expected, tagName, classes)
{
    var config = {tagName: tagName, classes: classes};
    FBTest.waitForDisplayedElement("console", config, function(row)
    {
        FBTest.compare(expected, row.textContent, "Verify: " +
            expression + " SHOULD BE " + expected);

        FBTest.clickToolbarButton(null, "fbConsoleClear");
        callback();
    });

    FBTest.executeCommand(expression);
}
