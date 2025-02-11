# NRP Class Finder 

A web application to find ITS classes by NRP for Informatics Departement. This tool helps you find all classes a student is enrolled in for the current semester.

## Features

- Search classes by NRP (use scrapping, so its take a while)

## How to Use
1. **Login and Get Your Session ID**
    - Go to [MyITS Academic](https://akademik.its.ac.id/myitsauth.php) and login with your credentials.
    - Press `F12` to open Developer Tools, go to the `Application` tab (Chrome) or `Storage` tab (Firefox), click on `Cookies` → `akademik.its.ac.id`, find `PHPSESSID`, and copy its value.

3. **Using the Tool**
   - Enter the NRP you want to search for
   - Paste your `PHPSESSID` into the Session ID field
   - Click "Search Classes"
   - Wait for results to appear (take a while)


## Technical Details

- Built with Next.js 14
- Uses server-side API routes for searching
- Supports semester 2 2024
- Searches classes A-K, P, and T
- Handles expired sessions automatically

## Important Notes

- Your session ID is only used to access MyITS Academic
- Sessions expire after some time, you'll need to get a new one
- This tool only shows current semester classes

## Contributing

Feel free to open issues or submit pull requests if you find any problems or have suggestions for improvements.

## License

MIT License - feel free to use and modify as needed.