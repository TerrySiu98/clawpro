//go:build !windows

package main

func addToUserPath(_ string, _ func(string, string, string)) {
	// Windows-only: modifies user PATH via registry. No-op on other platforms.
}

func readRegistryPath(_, _ string) (string, error) {
	return "", nil
}
