import { withPodfile } from "@expo/config-plugins";
import {
  applySpotifyIosPod,
  PODFILE_SPOTIFY_IOS_POD,
  withSpotifyIosPod,
} from "../ios/withSpotifyIosPod";

jest.mock("@expo/config-plugins", () => ({
  withPodfile: jest.fn(),
}));

const mockedWithPodfile = jest.mocked(withPodfile);

const SAMPLE_PODFILE = `platform :ios, '16.4'

target 'MyApp' do
  use_expo_modules!
end
`;

describe("applySpotifyIosPod", () => {
  it("injects SpotifyiOS pod line after use_expo_modules!", () => {
    const result = applySpotifyIosPod(SAMPLE_PODFILE);
    expect(result).toContain(PODFILE_SPOTIFY_IOS_POD);
    expect(result.indexOf("use_expo_modules!")).toBeLessThan(
      result.indexOf("pod 'SpotifyiOS'"),
    );
  });

  it("is idempotent when applied twice", () => {
    const once = applySpotifyIosPod(SAMPLE_PODFILE);
    const twice = applySpotifyIosPod(once);
    expect(twice).toBe(once);
  });
});

describe("withSpotifyIosPod", () => {
  beforeEach(() => jest.clearAllMocks());

  it("modifies the Podfile via withPodfile", () => {
    mockedWithPodfile.mockImplementation((config, fn) =>
      (fn as Function)({
        ...config,
        modResults: { contents: SAMPLE_PODFILE },
      }),
    );

    const result = withSpotifyIosPod({
      name: "test",
      slug: "test",
    } as any) as any;

    expect(mockedWithPodfile).toHaveBeenCalled();
    expect(result.modResults.contents).toContain("pod 'SpotifyiOS'");
  });
});
