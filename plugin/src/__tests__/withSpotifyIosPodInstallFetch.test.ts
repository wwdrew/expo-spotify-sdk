import { withPodfile } from "@expo/config-plugins";

import {
  applySpotifyIosPodInstallFetch,
  PODFILE_FETCH_TAG,
  PODFILE_PRE_INSTALL_RUBY,
  withSpotifyIosPodInstallFetch,
} from "../ios/withSpotifyIosPodInstallFetch";

jest.mock("@expo/config-plugins", () => ({
  withPodfile: jest.fn(),
}));

const mockedWithPodfile = jest.mocked(withPodfile);

const SAMPLE_PODFILE = `# @generated
platform :ios, '16.4'

prepare_react_native_project!

target 'MyApp' do
  use_expo_modules!
end
`;

describe("applySpotifyIosPodInstallFetch", () => {
  it("injects pre_install after platform :ios", () => {
    const result = applySpotifyIosPodInstallFetch(SAMPLE_PODFILE);

    expect(result).toContain(PODFILE_PRE_INSTALL_RUBY);
    expect(result.indexOf("platform :ios")).toBeLessThan(
      result.indexOf("pre_install do |installer|"),
    );
    expect(result).toContain(`# @generated begin ${PODFILE_FETCH_TAG}`);
  });

  it("is idempotent when the tagged block is already present", () => {
    const once = applySpotifyIosPodInstallFetch(SAMPLE_PODFILE);
    const twice = applySpotifyIosPodInstallFetch(once);

    expect(twice).toBe(once);
  });
});

describe("withSpotifyIosPodInstallFetch", () => {
  it("wires through withPodfile", () => {
    mockedWithPodfile.mockImplementation((config, fn) =>
      (fn as Function)({
        ...config,
        modResults: { contents: SAMPLE_PODFILE, language: "ruby" },
      }),
    );

    const result = withSpotifyIosPodInstallFetch({ name: "test" } as never);
    const contents = (result as { modResults: { contents: string } }).modResults
      .contents;

    expect(contents).toContain("fetch-spotify-ios-sdk.sh");
  });
});
