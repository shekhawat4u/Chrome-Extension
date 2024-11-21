document.addEventListener("DOMContentLoaded", () => {
  const tabsContainer = document.getElementById("tabs-container");
  const savedGroupsContainer = document.getElementById("saved-groups");
  const saveGroupButton = document.getElementById("save-group");
  const darkModeToggle = document.getElementById("dark-mode-toggle");
  const searchInput = document.getElementById("search-input");
  const searchButton = document.getElementById("search-tabs");

  // Load initial dark mode state
  chrome.storage.sync.get("darkMode", (data) => {
    if (data.darkMode) {
      document.body.classList.add("dark-mode");
    }
  });

  // Dark mode toggle button handler
  darkModeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDarkMode = document.body.classList.contains("dark-mode");

    // Save the state to Chrome storage
    chrome.storage.sync.set({ darkMode: isDarkMode }, () => {
      console.log(`Dark mode is now ${isDarkMode ? "enabled" : "disabled"}.`);
    });
  });

  // Auto-save function for saving tabs to a new group every 5 minutes
  const autoSaveTabs = () => {
    chrome.tabs.query({}, (tabs) => {
      const groupName = "Auto-Saved Tabs";

      chrome.storage.sync.get(groupName, (data) => {
        const group = data[groupName] || [];
        const currentTabs = tabs.map((tab) => ({
          title: tab.title,
          url: tab.url
        }));

        // Add current tabs to the Auto-Saved group if not already present
        currentTabs.forEach((tab) => {
          if (!group.some((savedTab) => savedTab.url === tab.url)) {
            group.push(tab);
          }
        });

        chrome.storage.sync.set({ [groupName]: group }, () => {
          console.log("Tabs auto-saved.");
        });
      });
    });
  };

  // Set an interval to auto-save every 5 seconds
  setInterval(autoSaveTabs, 5000);

  // Function to display tabs with a checkbox to select them
  const displayTabs = (tabs) => {
    tabsContainer.innerHTML = ""; // Clear previous tabs
    if (tabs.length === 0) {
      tabsContainer.innerHTML = `<p class="text-gray-500">No tabs found.</p>`;
      return;
    }
    tabs.forEach((tab) => {
      const tabItem = document.createElement("div");
      tabItem.className =
        "flex items-center justify-between p-3 bg-white shadow rounded-lg"; // justify-between to space out left and right

      tabItem.innerHTML = ` 
        <div class="flex items-center">
          <input type="checkbox" class="select-tab mr-2" data-title="${tab.title}" data-url="${tab.url}">
          <span class="text-gray-700 truncate">${tab.title}</span>
        </div>
        <span class="text-sm text-blue-500 truncate">${new URL(tab.url).hostname}</span>
      `;
      tabsContainer.appendChild(tabItem);
    });
  };

  // Fetch all tabs on load
  chrome.tabs.query({}, (tabs) => {
    displayTabs(tabs);
  });

  // Handle tab search
  searchButton.addEventListener("click", () => {
    const query = searchInput.value.toLowerCase();
    if (!query) {
      alert("Please enter a search term.");
      return;
    }

    chrome.tabs.query({}, (tabs) => {
      const filteredTabs = tabs.filter(
        (tab) =>
          tab.title.toLowerCase().includes(query) ||
          tab.url.toLowerCase().includes(query)
      );
      displayTabs(filteredTabs);
    });
  });

  // Search on Enter keypress
  searchInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      searchButton.click();
    }
  });

  // Handle selecting tabs to add to group
  const selectedTabs = [];

  tabsContainer.addEventListener("change", (event) => {
    const checkbox = event.target;
    if (checkbox.classList.contains("select-tab")) {
      const tab = {
        title: checkbox.getAttribute("data-title"),
        url: checkbox.getAttribute("data-url")
      };

      if (checkbox.checked) {
        selectedTabs.push(tab);
      } else {
        const index = selectedTabs.findIndex(
          (selectedTab) => selectedTab.url === tab.url
        );
        if (index > -1) {
          selectedTabs.splice(index, 1);
        }
      }
    }
  });

  // Save a new group
  saveGroupButton.addEventListener("click", () => {
    if (selectedTabs.length === 0) {
      alert("Please select at least one tab to add to the group.");
      return;
    }

    const groupName = prompt("Enter a group name:");
    if (!groupName || groupName.trim() === "") {
      alert("Group name cannot be empty!");
      return;
    }

    chrome.storage.sync.get(groupName, (data) => {
      const group = data[groupName] || [];
      group.push(...selectedTabs);

      chrome.storage.sync.set({ [groupName]: group }, () => {
        alert("Group saved successfully!");
        selectedTabs.length = 0; // Clear selected tabs
        loadSavedGroups();
      });
    });
  });

  // Fetch and display saved groups
  const loadSavedGroups = () => {
    chrome.storage.sync.get(null, (groups) => {
      savedGroupsContainer.innerHTML = "";
      Object.keys(groups).forEach((groupName) => {
        const group = groups[groupName];
        if (!Array.isArray(group)) return;

        const groupItem = document.createElement("li");
        groupItem.className =
          "flex flex-col bg-white shadow rounded-lg p-3 mb-3";
        
        // If group name is "Auto-Saved Tabs", only remove Add/Delete buttons but keep "Reopen All"
        let buttonsHtml = "";
        if (groupName !== "Auto-Saved Tabs") {
          buttonsHtml = `
            <button class="reopen-group text-green-500 hover:text-green-700" data-group="${groupName}">Reopen All</button>
            <button class="add-to-group text-yellow-500 hover:text-yellow-700" data-group="${groupName}">Add</button>
            <button class="delete-group text-red-500 hover:text-red-700" data-group="${groupName}">Delete</button>
          `;
        } else {
          // For "Auto-Saved Tabs", keep only the "Reopen All" button
          buttonsHtml = `
            <button class="reopen-group text-green-500 hover:text-green-700" data-group="${groupName}">Reopen All</button>
          `;
        }

        groupItem.innerHTML = `
          <div class="flex justify-between items-center">
            <span class="text-gray-700 font-medium truncate">
              ${groupName} <span class="text-sm text-gray-500">(${group.length} tabs)</span>
            </span>
            <div class="flex items-center space-x-2">
              ${buttonsHtml}
            </div>
          </div>
          <ul class="space-y-2 mt-2">
            ${group
              .map(
                (tab, index) => ` 
                <li class="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                  <span class="text-sm text-blue-500 truncate">${tab.title}</span>
                  <div class="flex items-center space-x-2">
                    <span class="text-xs text-gray-500">${new URL(tab.url).hostname}</span>
                    <button class="reopen-tab text-green-500 hover:text-green-700" data-group="${groupName}" data-index="${index}">Reopen</button>
                    <button class="delete-tab text-red-500 hover:text-red-700" data-group="${groupName}" data-index="${index}">Remove</button>
                  </div>
                </li>
              `).join("")}
          </ul>
        `;
        savedGroupsContainer.appendChild(groupItem);
      });
    });
  };

  // Handle group actions
  savedGroupsContainer.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;

    const groupName = target.dataset.group;

    // Reopen group
    if (target.classList.contains("reopen-group")) {
      chrome.storage.sync.get(groupName, (data) => {
        const tabs = data[groupName];
        if (!tabs || tabs.length === 0) {
          alert("This group has no tabs to open.");
          return;
        }
        tabs.forEach((tab) => chrome.tabs.create({ url: tab.url }));
      });
    }

    // Reopen a single tab
    if (target.classList.contains("reopen-tab")) {
      const index = target.dataset.index;
      chrome.storage.sync.get(groupName, (data) => {
        const group = data[groupName];
        if (group && group[index]) {
          chrome.tabs.create({ url: group[index].url });
        } else {
          alert("Unable to find the tab to reopen.");
        }
      });
    }

    // Add tabs to group
    if (target.classList.contains("add-to-group")) {
      chrome.storage.sync.get(groupName, (data) => {
        const group = data[groupName];
        const newTabs = selectedTabs.filter(
          (tab) => !group.some((savedTab) => savedTab.url === tab.url)
        );
        group.push(...newTabs);
        chrome.storage.sync.set({ [groupName]: group }, () => {
          alert("Tabs added to the group.");
          loadSavedGroups();
        });
      });
    }

    // Delete a group
    if (target.classList.contains("delete-group")) {
      if (confirm(`Are you sure you want to delete the group "${groupName}"?`)) {
        chrome.storage.sync.remove(groupName, () => {
          alert("Group deleted.");
          loadSavedGroups();
        });
      }
    }

    // Remove tab from group
    if (target.classList.contains("delete-tab")) {
      const index = target.dataset.index;
      chrome.storage.sync.get(groupName, (data) => {
        const group = data[groupName];
        group.splice(index, 1); // Remove the tab at the specified index
        chrome.storage.sync.set({ [groupName]: group }, () => {
          alert("Tab removed from the group.");
          loadSavedGroups();
        });
      });
    }
  });

  // Load saved groups when the page loads
  loadSavedGroups();
});
